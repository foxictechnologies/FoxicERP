import React, { useState, useEffect } from "react";
import { Plus, Lock, History, Save, Search, Clock, ShieldAlert, CheckCircle2, XCircle, Trash2, KeyRound } from "lucide-react";
import { T, ROLES } from "../lib/constants";
import { Card, Badge, Btn, Field, Input, Select, Modal, EmptyState, SectionHeader, AcceptBtn, RejectBtn, CancelBtn } from "../components/ui";
import { insertRow, updateRow, deleteRow, deleteUserProfile } from "../lib/db";
import { supabase } from "../supabaseClient";

// Local Storage helpers for Manager Pending Requests (avoids Supabase RLS permission errors for non-Owners)
const PENDING_USERS_KEY = (companyId) => `erp_pending_user_requests_${companyId || "default"}`;
const PENDING_ROLES_KEY = (companyId) => `erp_pending_role_requests_${companyId || "default"}`;
const PENDING_MEMBER_ACTIONS_KEY = (companyId) => `erp_pending_member_actions_${companyId || "default"}`;

const getPendingUsers = (companyId) => {
  try {
    const raw = localStorage.getItem(PENDING_USERS_KEY(companyId));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

const savePendingUsers = (companyId, list) => {
  try {
    localStorage.setItem(PENDING_USERS_KEY(companyId), JSON.stringify(list));
  } catch (e) {}
};

const getPendingRoles = (companyId) => {
  try {
    const raw = localStorage.getItem(PENDING_ROLES_KEY(companyId));
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

const savePendingRoles = (companyId, obj) => {
  try {
    localStorage.setItem(PENDING_ROLES_KEY(companyId), JSON.stringify(obj));
  } catch (e) {}
};

const getPendingMemberActions = (companyId) => {
  try {
    const raw = localStorage.getItem(PENDING_MEMBER_ACTIONS_KEY(companyId));
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

const savePendingMemberActions = (companyId, obj) => {
  try {
    localStorage.setItem(PENDING_MEMBER_ACTIONS_KEY(companyId), JSON.stringify(obj));
  } catch (e) {}
};

export default function UsersAuditModule({ ctx }) {
  const { users, setUsers, auditLog, currentUser, role, company } = ctx;
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState("");
  const blank = () => ({ authUserId: "", name: "", email: "", password: "", role: "Sales" });
  const [form, setForm] = useState(blank());

  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingRoles, setPendingRoles] = useState({});
  const [pendingMemberActions, setPendingMemberActions] = useState({});
  const [creatingAuth, setCreatingAuth] = useState(false);

  const [pwdModal, setPwdModal] = useState({
    open: false,
    title: "",
    description: "",
    password: "",
    error: "",
    loading: false,
    onConfirm: null
  });

  useEffect(() => {
    if (company?.id) {
      setPendingUsers(getPendingUsers(company.id));
      setPendingRoles(getPendingRoles(company.id));
      setPendingMemberActions(getPendingMemberActions(company.id));
    }
  }, [company?.id]);

  const promptPasswordVerify = (title, description, onVerified) => {
    setPwdModal({
      open: true,
      title,
      description,
      password: "",
      error: "",
      loading: false,
      onConfirm: async (enteredPassword) => {
        if (!enteredPassword) {
          setPwdModal((prev) => ({ ...prev, error: "Please enter your login password." }));
          return;
        }

        setPwdModal((prev) => ({ ...prev, loading: true, error: "" }));
        try {
          const userEmail = currentUser?.email;
          if (!userEmail) {
            setPwdModal((prev) => ({ ...prev, loading: false, error: "User email not found for verification." }));
            return;
          }

          const { data, error } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password: enteredPassword
          });

          if (error) {
            console.warn("Auth password verification failed:", error.message);
            setPwdModal((prev) => ({
              ...prev,
              loading: false,
              error: "Galat Password! Kripya apna sahi login password daalein."
            }));
            return; // STRICT STOP on wrong password
          }

          // Verification succeeded
          setPwdModal((prev) => ({ ...prev, open: false, loading: false, password: "", error: "" }));
          await onVerified();
        } catch (err) {
          console.error("Password verification error:", err);
          setPwdModal((prev) => ({
            ...prev,
            loading: false,
            error: err.message || "Password verification failed."
          }));
        }
      }
    });
  };

  const isOwnerRole = (r) => r === "Owner" || r === "Business Owner" || (typeof r === "string" && r.toLowerCase().includes("owner"));
  const isOwner = role === "Owner" || role === "Business Owner";
  const isManager = role === "Manager" || role === "Operations Manager";
  const isViewer = role === "Viewer" || role === "Viewer (Read Only)";

  if (!isOwner && !isManager && !isViewer) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={Lock}
          title="Restricted access"
          subtitle="User management and the login/activity log are visible to the business Owner and Manager only."
        />
      </Card>
    );
  }

  const handleAutoCreateAuthUser = async (customForm = form) => {
    if (!customForm.email || !customForm.password) {
      alert("Please enter Email address and Password first.");
      return null;
    }
    setCreatingAuth(true);
    try {
      const resp = await fetch("/api/auth/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: customForm.email.trim(),
          password: customForm.password.trim(),
          name: customForm.name.trim()
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Failed to create Auth user via backend API");
      }
      const fetchedUid = data.user.id;
      setForm((prev) => ({ ...prev, authUserId: fetchedUid }));
      return fetchedUid;
    } catch (err) {
      alert("Auth User Creation Error: " + err.message);
      return null;
    } finally {
      setCreatingAuth(false);
    }
  };

  const addUser = async () => {
    if (!form.name) {
      alert("Please enter team member's full name.");
      return;
    }

    let finalUid = form.authUserId?.trim();

    // Auto-create Auth User ID via backend API if empty
    if (!finalUid) {
      if (!form.email || !form.password) {
        alert("Please enter Email & Password to auto-create Supabase Auth User ID, or paste the User ID manually.");
        return;
      }
      finalUid = await handleAutoCreateAuthUser();
      if (!finalUid) return;
    }

    if (form.role === "Owner" && !isOwner) {
      alert("Manager Business Owner role select ya request nahi kar sakte.");
      return;
    }

    if (isOwner) {
      // Owner creates user directly in Supabase DB
      try {
        const row = await insertRow("profiles", {
          id: finalUid,
          companyId: company.id,
          name: form.name.trim(),
          role: form.role,
          status: "Active"
        });
        setUsers((prev) => [...prev.filter((x) => x.id !== row.id), row]);
        ctx.logAudit("User account created", `${form.name} as ${form.role} (UID: ${finalUid})`);
        alert(`User ${form.name} created and activated!`);
        setShowForm(false);
        setForm(blank());
      } catch (e) {
        alert("Couldn't add user — check the Auth User ID is correct and not already linked to a profile.\n\n" + e.message);
      }
    } else {
      // Manager submits pending request to Owner
      const pendingItem = {
        id: finalUid,
        companyId: company.id,
        name: form.name.trim(),
        role: form.role,
        status: "Pending Approval",
        requestedBy: currentUser?.name || "Manager",
        createdAt: new Date().toISOString()
      };

      const updated = [...pendingUsers.filter((p) => p.id !== pendingItem.id), pendingItem];
      savePendingUsers(company.id, updated);
      setPendingUsers(updated);

      ctx.logAudit("User creation requested", `${form.name} as ${form.role} requested by ${currentUser?.name || "Manager"}`);
      alert(`User creation request for ${form.name} submitted! It will be activated once the Owner approves it.`);
      setShowForm(false);
      setForm(blank());
    }
  };

  const approveUser = async (p) => {
    if (!isOwner) return;
    try {
      const row = await insertRow("profiles", {
        id: p.id,
        companyId: company.id,
        name: p.name,
        role: p.role,
        status: "Active"
      });
      setUsers((prev) => [...prev.filter((u) => u.id !== row.id), row]);

      const updatedPending = pendingUsers.filter((item) => item.id !== p.id);
      savePendingUsers(company.id, updatedPending);
      setPendingUsers(updatedPending);

      ctx.logAudit("User creation approved", `${p.name} (${p.role}) approved by Owner`);
      alert(`Approved and activated ${p.name}'s account.`);
    } catch (e) {
      alert("Could not approve user: " + e.message);
    }
  };

  const rejectUser = (p) => {
    const isRequester = currentUser?.name === p.requestedBy || currentUser?.id === p.requestedById;
    if (!isOwner && !isManager && !isRequester) return;

    if (!confirm(`Cancel user creation request for ${p.name}?`)) return;

    const updatedPending = pendingUsers.filter((item) => item.id !== p.id);
    savePendingUsers(company.id, updatedPending);
    setPendingUsers(updatedPending);

    ctx.logAudit("User creation request cancelled", `${p.name} creation request cancelled/rejected`);
    alert(`User creation request for ${p.name} cancelled.`);
  };

  const changeRole = async (u, newRole) => {
    if (u.id === currentUser.id) return;
    if ((isOwnerRole(u.role) || isOwnerRole(newRole)) && !isOwner) {
      alert("Manager Business Owner role change ya request nahi kar sakte.");
      return;
    }

    const isTargetOwner = isOwnerRole(u.role);

    promptPasswordVerify(
      "Confirm Password to Change Role",
      `Enter your login password to ${isOwner ? (isTargetOwner ? "request" : "change") : "request"} ${u.name}'s role to ${newRole}.`,
      async () => {
        if (isOwner && isTargetOwner) {
          // Business Owner changing ANOTHER Business Owner's role -> Requires target Owner's accept/reject!
          const updatedPendingRoles = {
            ...pendingRoles,
            [u.id]: {
              requestedRole: newRole,
              requestedBy: currentUser?.name || "Business Owner",
              requestedById: currentUser?.id,
              targetUserId: u.id,
              isOwnerToOwner: true,
              createdAt: new Date().toISOString()
            }
          };
          savePendingRoles(company.id, updatedPendingRoles);
          setPendingRoles(updatedPendingRoles);

          ctx.logAudit(
            "Owner role change requested",
            `${u.name}: role change to ${newRole} requested by ${currentUser?.name || "Business Owner"}`
          );
          alert(`Role change request sent to ${u.name} (${newRole}). It will take effect once they Accept or Reject it.`);
          return;
        }

        if (isOwner) {
          // Owner updates non-Owner role directly in DB
          try {
            const row = await updateRow("profiles", u.id, { role: newRole });
            setUsers((prev) => prev.map((x) => (x.id === row.id ? row : x)));

            const updatedPendingRoles = { ...pendingRoles };
            delete updatedPendingRoles[u.id];
            savePendingRoles(company.id, updatedPendingRoles);
            setPendingRoles(updatedPendingRoles);

            ctx.logAudit("User role changed", `${u.name}: ${u.role} → ${newRole}`);
            alert(`Role for ${u.name} changed to ${newRole}.`);
          } catch (e) {
            alert("Could not change role: " + e.message);
          }
        } else {
          // Manager requests role change
          const updatedPendingRoles = {
            ...pendingRoles,
            [u.id]: {
              requestedRole: newRole,
              requestedBy: currentUser?.name || "Manager",
              requestedById: currentUser?.id,
              targetUserId: u.id,
              isOwnerToOwner: false,
              createdAt: new Date().toISOString()
            }
          };
          savePendingRoles(company.id, updatedPendingRoles);
          setPendingRoles(updatedPendingRoles);

          ctx.logAudit("Role change requested", `${u.name}: requested ${newRole} by ${currentUser?.name || "Manager"}`);
          alert(`Role change request for ${u.name} (${newRole}) sent to Owner for approval.`);
        }
      }
    );
  };

  const approveRoleChange = async (u, requestedRole) => {
    const roleReq = pendingRoles[u.id];
    const isOwnerToOwner = roleReq?.isOwnerToOwner;

    // If it's an Owner-to-Owner request, only the target Owner themselves can accept it!
    if (isOwnerToOwner && u.id !== currentUser.id) {
      alert(`Only ${u.name} can accept or reject this role change request.`);
      return;
    }

    if (!isOwnerToOwner && !isOwner) return;

    promptPasswordVerify(
      `Confirm Password to ${isOwnerToOwner ? "Accept Role Change" : "Approve Role Change"}`,
      `Enter your login password to approve role change to ${requestedRole} for ${u.name}.`,
      async () => {
        try {
          const row = await updateRow("profiles", u.id, { role: requestedRole });
          setUsers((prev) => prev.map((x) => (x.id === row.id ? row : x)));

          const updatedPendingRoles = { ...pendingRoles };
          delete updatedPendingRoles[u.id];
          savePendingRoles(company.id, updatedPendingRoles);
          setPendingRoles(updatedPendingRoles);

          ctx.logAudit("Role change accepted", `${u.name} accepted role change to ${requestedRole}`);
          alert(`Role change for ${u.name} to ${requestedRole} accepted and active.`);

          if (u.id === currentUser.id) {
            window.location.reload();
          }
        } catch (e) {
          alert("Could not approve role change: " + e.message);
        }
      }
    );
  };

  const rejectRoleChange = (u) => {
    const roleReq = pendingRoles[u.id];
    const isOwnerToOwner = roleReq?.isOwnerToOwner;
    const isRequester = currentUser?.id === roleReq?.requestedById || currentUser?.name === roleReq?.requestedBy;

    if (isOwnerToOwner && u.id !== currentUser.id && !isRequester) {
      alert(`Only ${u.name} or the requesting user can cancel/reject this request.`);
      return;
    }

    if (!isOwnerToOwner && !isOwner && !isRequester && !isManager) return;

    const updatedPendingRoles = { ...pendingRoles };
    delete updatedPendingRoles[u.id];
    savePendingRoles(company.id, updatedPendingRoles);
    setPendingRoles(updatedPendingRoles);

    ctx.logAudit("Role change cancelled", `${u.name} role change request cancelled/rejected`);
    alert(`Role change request for ${u.name} was cancelled/rejected.`);
  };

  const toggleStatus = async (u) => {
    if (u.id === currentUser.id) return;
    const newStatus = u.status === "Active" ? "Deactivated" : "Active";
    const actionName = newStatus === "Active" ? "reactivate" : "deactivate";

    if (isManager) {
      if (isOwnerRole(u.role)) {
        alert("Managers cannot deactivate or reactivate Business Owner accounts.");
        return;
      }
      promptPasswordVerify(
        `Confirm Password to Request ${newStatus}`,
        `Enter your login password to submit a request to the Owner to ${actionName} ${u.name}'s account.`,
        async () => {
          const updated = {
            ...pendingMemberActions,
            [u.id]: {
              action: actionName,
              targetUserId: u.id,
              targetUserName: u.name,
              targetUserRole: u.role,
              requestedBy: currentUser?.name || "Manager",
              requestedById: currentUser?.id,
              isOwnerToOwner: false,
              createdAt: new Date().toISOString()
            }
          };
          savePendingMemberActions(company.id, updated);
          setPendingMemberActions(updated);
          ctx.logAudit(`${actionName} requested`, `${u.name} ${actionName} requested by ${currentUser?.name || "Manager"}`);
          alert(`Request to ${actionName} ${u.name} submitted to Owner for approval.`);
        }
      );
      return;
    }

    if (isOwner) {
      if (isOwnerRole(u.role)) {
        // Business Owner deactivating/reactivating ANOTHER Business Owner -> Requires target Owner's accept/reject!
        promptPasswordVerify(
          `Confirm Password to Request ${newStatus} for Owner`,
          `Enter your login password to submit a request to Business Owner ${u.name} to ${actionName} their account.`,
          async () => {
            const updated = {
              ...pendingMemberActions,
              [u.id]: {
                action: actionName,
                targetUserId: u.id,
                targetUserName: u.name,
                targetUserRole: "Owner",
                requestedBy: currentUser?.name || "Business Owner",
                requestedById: currentUser?.id,
                isOwnerToOwner: true,
                createdAt: new Date().toISOString()
              }
            };
            savePendingMemberActions(company.id, updated);
            setPendingMemberActions(updated);
            ctx.logAudit(`Owner ${actionName} requested`, `${u.name} ${actionName} requested by ${currentUser?.name || "Business Owner"}`);
            alert(`Request to ${actionName} Business Owner ${u.name} sent. It will take effect once ${u.name} Accepts or Rejects it.`);
          }
        );
        return;
      }

      promptPasswordVerify(
        `Confirm Password to ${newStatus}`,
        `Enter your login password to ${actionName} ${u.name}'s account.`,
        async () => {
          try {
            const row = await updateRow("profiles", u.id, { status: newStatus });
            setUsers((prev) => prev.map((x) => (x.id === row.id ? row : x)));

            const updatedActions = { ...pendingMemberActions };
            delete updatedActions[u.id];
            savePendingMemberActions(company.id, updatedActions);
            setPendingMemberActions(updatedActions);

            ctx.logAudit(newStatus === "Active" ? "User reactivated" : "User deactivated", `${u.name}`);
            alert(`Account for ${u.name} has been ${newStatus.toLowerCase()}.`);
          } catch (e) {
            alert("Could not update user status: " + e.message);
          }
        }
      );
    }
  };

  const deleteMember = async (u) => {
    if (u.id === currentUser.id) {
      alert("You cannot delete your own account.");
      return;
    }

    if (isManager) {
      if (isOwnerRole(u.role)) {
        alert("Managers cannot delete Business Owner accounts.");
        return;
      }
      promptPasswordVerify(
        "Confirm Password to Request Deletion",
        `Enter your login password to submit a request to the Owner to delete ${u.name}'s account.`,
        async () => {
          const updated = {
            ...pendingMemberActions,
            [u.id]: {
              action: "delete",
              targetUserId: u.id,
              targetUserName: u.name,
              targetUserRole: u.role,
              requestedBy: currentUser?.name || "Manager",
              requestedById: currentUser?.id,
              isOwnerToOwner: false,
              createdAt: new Date().toISOString()
            }
          };
          savePendingMemberActions(company.id, updated);
          setPendingMemberActions(updated);
          ctx.logAudit("User deletion requested", `${u.name} deletion requested by ${currentUser?.name || "Manager"}`);
          alert(`Deletion request for ${u.name} submitted to Owner for approval.`);
        }
      );
      return;
    }

    if (isOwner) {
      if (isOwnerRole(u.role)) {
        // Business Owner deleting ANOTHER Business Owner -> Requires target Owner's accept/reject!
        promptPasswordVerify(
          "Confirm Password to Request Deletion of Owner",
          `Enter your login password to submit a deletion request to Business Owner ${u.name}.`,
          async () => {
            const updated = {
              ...pendingMemberActions,
              [u.id]: {
                action: "delete",
                targetUserId: u.id,
                targetUserName: u.name,
                targetUserRole: "Owner",
                requestedBy: currentUser?.name || "Business Owner",
                requestedById: currentUser?.id,
                isOwnerToOwner: true,
                createdAt: new Date().toISOString()
              }
            };
            savePendingMemberActions(company.id, updated);
            setPendingMemberActions(updated);
            ctx.logAudit("Owner deletion requested", `${u.name} deletion requested by ${currentUser?.name || "Business Owner"}`);
            alert(`Deletion request for Business Owner ${u.name} sent. It will take effect once ${u.name} Accepts or Rejects it.`);
          }
        );
        return;
      }

      promptPasswordVerify(
        "Confirm Password to Delete Member",
        `PERMANENT ACTION: Enter your login password to delete ${u.name} from the system.`,
        async () => {
          try {
            if (u.status === "Pending Approval") {
              const updatedPending = pendingUsers.filter((p) => p.id !== u.id);
              savePendingUsers(company.id, updatedPending);
              setPendingUsers(updatedPending);
            } else {
              // Call backend API to delete user from Supabase Auth admin & profiles table
              try {
                await fetch("/api/auth/delete-user", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: u.id, email: u.email })
                });
              } catch (apiErr) {
                console.warn("[Backend Delete User API] Warning:", apiErr.message);
              }

              try {
                await deleteUserProfile(u.id);
              } catch (delErr) {
                console.warn("deleteUserProfile warning:", delErr.message);
              }

              // Always remove from local users state and localStorage for instant UI update
              setUsers((prev) => {
                const nextUsers = prev.filter((x) => x.id !== u.id);
                try {
                  localStorage.setItem("erp_users", JSON.stringify(nextUsers));
                } catch (e) {}
                return nextUsers;
              });
            }

            const updatedActions = { ...pendingMemberActions };
            delete updatedActions[u.id];
            savePendingMemberActions(company.id, updatedActions);
            setPendingMemberActions(updatedActions);

            const updatedRoles = { ...pendingRoles };
            delete updatedRoles[u.id];
            savePendingRoles(company.id, updatedRoles);
            setPendingRoles(updatedRoles);

            ctx.logAudit("User account deleted", `${u.name} (${u.role}) removed by ${currentUser.name}`);
            alert(`User account for ${u.name} has been deleted.`);
          } catch (e) {
            console.error("deleteMember failed:", e);
            alert("Could not remove user: " + e.message);
          }
        }
      );
    }
  };

  const approveMemberAction = async (u, actionItem) => {
    const isOwnerToOwner = actionItem?.isOwnerToOwner;

    if (isOwnerToOwner && u.id !== currentUser.id) {
      alert(`Only ${u.name} can accept or reject this request.`);
      return;
    }

    if (!isOwnerToOwner && !isOwner) return;
    const { action } = actionItem;

    promptPasswordVerify(
      `Confirm Password to ${isOwnerToOwner ? "Accept Request" : "Approve " + action.toUpperCase()}`,
      `Enter your login password to ${isOwnerToOwner ? "accept" : "approve"} request to ${action} ${u.name}'s account.`,
      async () => {
        try {
          if (action === "deactivate") {
            const row = await updateRow("profiles", u.id, { status: "Deactivated" });
            setUsers((prev) => prev.map((x) => (x.id === row.id ? row : x)));
          } else if (action === "reactivate") {
            const row = await updateRow("profiles", u.id, { status: "Active" });
            setUsers((prev) => prev.map((x) => (x.id === row.id ? row : x)));
          } else if (action === "delete") {
            // Call backend API to delete user from Supabase Auth admin & profiles table
            try {
              await fetch("/api/auth/delete-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: u.id, email: u.email })
              });
            } catch (apiErr) {
              console.warn("[Backend Delete User API] Warning:", apiErr.message);
            }

            try {
              await deleteUserProfile(u.id);
            } catch (delErr) {
              console.warn("deleteUserProfile warning:", delErr.message);
            }
            setUsers((prev) => {
              const nextUsers = prev.filter((x) => x.id !== u.id);
              try {
                localStorage.setItem("erp_users", JSON.stringify(nextUsers));
              } catch (e) {}
              return nextUsers;
            });
          }

          const updatedActions = { ...pendingMemberActions };
          delete updatedActions[u.id];
          savePendingMemberActions(company.id, updatedActions);
          setPendingMemberActions(updatedActions);

          ctx.logAudit(`User ${action} ${isOwnerToOwner ? "accepted" : "approved"}`, `${u.name} ${action} request processed`);
          alert(`Account ${action} request accepted and processed for ${u.name}.`);

          if (isOwnerToOwner && u.id === currentUser.id && (action === "deactivate" || action === "delete")) {
            window.location.reload();
          }
        } catch (e) {
          alert(`Could not process ${action}: ` + e.message);
        }
      }
    );
  };

  const rejectMemberAction = (u, actionItem) => {
    const isOwnerToOwner = actionItem?.isOwnerToOwner;
    const isRequester = currentUser?.id === actionItem?.requestedById || currentUser?.name === actionItem?.requestedBy;

    if (isOwnerToOwner && u.id !== currentUser.id && !isRequester) {
      alert(`Only ${u.name} or the requesting user can cancel/reject this request.`);
      return;
    }

    if (!isOwnerToOwner && !isOwner && !isRequester && !isManager) return;

    const updatedActions = { ...pendingMemberActions };
    delete updatedActions[u.id];
    savePendingMemberActions(company.id, updatedActions);
    setPendingMemberActions(updatedActions);

    ctx.logAudit(`User ${actionItem.action} request cancelled`, `${u.name} ${actionItem.action} request cancelled/rejected`);
    alert(`Request to ${actionItem.action} ${u.name}'s account was cancelled/rejected.`);
  };

  // Combine real DB users with local pending user requests and current logged-in profile
  const baseUsers = [...users];
  if (currentUser?.id && !baseUsers.some((u) => u.id === currentUser.id)) {
    baseUsers.push(currentUser);
  }

  const displayUsers = [
    ...baseUsers,
    ...pendingUsers.filter((p) => !baseUsers.some((u) => u.id === p.id))
  ];

  const pendingUserCount = pendingUsers.length;
  const pendingRoleCount = Object.keys(pendingRoles).length;
  const pendingActionCount = Object.keys(pendingMemberActions).length;
  const totalPending = pendingUserCount + pendingRoleCount + pendingActionCount;
  const myPendingRoleReq = pendingRoles[currentUser?.id];
  const myPendingMemberAction = pendingMemberActions[currentUser?.id];

  const filteredLog = auditLog.filter((l) => !q || l.userName?.toLowerCase().includes(q.toLowerCase()) || l.action?.toLowerCase().includes(q.toLowerCase()));
  const loginEvents = auditLog.filter((l) => l.action === "Login" || l.action === "Logout");

  return (
    <div>
      <SectionHeader
        title="Users & Access Log"
        subtitle="Manage team members, roles, and review access logs"
        action={!isViewer ? (
          <Btn icon={Plus} onClick={() => { setForm(blank()); setShowForm(true); }}>
            {isOwner ? "New User" : "Request New User"}
          </Btn>
        ) : null}
      />

      {/* Target Owner Accept/Reject Role Change Banner */}
      {myPendingRoleReq && myPendingRoleReq.isOwnerToOwner && (
        <div
          className="text-xs px-4 py-3 rounded-2xl mb-4 flex items-center justify-between gap-3 shadow-md border animate-bounce"
          style={{ background: T.amberWash, color: T.amber, borderColor: "rgba(176,109,0,0.30)" }}
        >
          <div className="flex items-center gap-2 font-medium">
            <Clock size={18} />
            <span>
              <b>Role Change Request:</b> {myPendingRoleReq.requestedBy} has requested to change your role to <b>{myPendingRoleReq.requestedRole}</b>.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AcceptBtn onClick={() => approveRoleChange(currentUser, myPendingRoleReq.requestedRole)}>
              Accept Request
            </AcceptBtn>
            <RejectBtn onClick={() => rejectRoleChange(currentUser)}>
              Reject
            </RejectBtn>
          </div>
        </div>
      )}

      {/* Target Owner Accept/Reject Deactivate/Delete Action Banner */}
      {myPendingMemberAction && myPendingMemberAction.isOwnerToOwner && (
        <div
          className="text-xs px-4 py-3 rounded-2xl mb-4 flex items-center justify-between gap-3 shadow-md border animate-bounce"
          style={{ background: T.redWash, color: T.red, borderColor: "rgba(215,0,21,0.30)" }}
        >
          <div className="flex items-center gap-2 font-medium">
            <Clock size={18} />
            <span>
              <b>Account Action Request:</b> {myPendingMemberAction.requestedBy} has requested to <b>{myPendingMemberAction.action.toUpperCase()}</b> your Business Owner account.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AcceptBtn onClick={() => approveMemberAction(currentUser, myPendingMemberAction)}>
              Accept Request
            </AcceptBtn>
            <RejectBtn onClick={() => rejectMemberAction(currentUser, myPendingMemberAction)}>
              Reject
            </RejectBtn>
          </div>
        </div>
      )}

      {/* Owner Pending Approvals Banner */}
      {isOwner && totalPending > 0 && !myPendingRoleReq?.isOwnerToOwner && (
        <div
          className="text-xs px-4 py-3 rounded-2xl mb-4 flex items-center justify-between gap-3 shadow-sm animate-pulse"
          style={{ background: T.amberWash, color: T.amber, border: "1px solid rgba(176,109,0,0.20)" }}
        >
          <div className="flex items-center gap-2 font-medium">
            <Clock size={16} />
            <span>
              <b>{totalPending} Pending Request{totalPending > 1 ? "s" : ""}</b> waiting for your approval
              ({pendingUserCount > 0 ? `${pendingUserCount} New User` : ""}{pendingUserCount > 0 && pendingRoleCount > 0 ? ", " : ""}{pendingRoleCount > 0 ? `${pendingRoleCount} Role Change` : ""}).
            </span>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider bg-amber-500/10 px-2 py-1 rounded-md">Action Required</span>
        </div>
      )}

      {/* Manager Hint Banner */}
      {isManager && (
        <div
          className="text-xs px-3.5 py-2.5 rounded-xl mb-4 flex items-center gap-2"
          style={{ background: T.navyWash, color: T.navy, border: "1px solid rgba(0,113,227,0.15)" }}
        >
          <ShieldAlert size={14} />
          <span>Aap naye user request kar sakte hain aur roles request kar sakte hain. Owner ki confirmation ke baad hi changes active honge.</span>
        </div>
      )}

      <div className="text-sm font-semibold mb-2" style={{ color: T.ink }}>Team members</div>
      <Card className="mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Name", "Role", "Status", "Last login", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: T.inkFaint }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayUsers.map((u) => {
                const lastLogin = auditLog.find((l) => l.userId === u.id && l.action === "Login");
                const isUserPending = u.status === "Pending Approval";
                const roleReq = pendingRoles[u.id];
                const hasPendingRole = !!roleReq;
                const pendingMemberAction = pendingMemberActions[u.id];

                return (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                    {/* Name */}
                    <td className="px-4 py-2.5 font-medium" style={{ color: T.ink }}>
                      <div>{u.name} {u.id === currentUser.id && <Badge tone="navy">You</Badge>}</div>
                      {u.requestedBy && (
                        <div className="text-[10px] mt-0.5" style={{ color: T.inkFaint }}>
                          Requested by {u.requestedBy}
                        </div>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        <Select
                          value={hasPendingRole ? roleReq.requestedRole : u.role}
                          onChange={(e) => changeRole(u, e.target.value)}
                          style={{ width: 150, padding: "4px 8px" }}
                          disabled={isViewer || u.id === currentUser.id || (!isOwner && u.role === "Owner")}
                        >
                          {Object.keys(ROLES)
                            .filter((r) => isOwner || r !== "Owner" || r === u.role)
                            .map((r) => (
                              <option key={r} value={r}>{ROLES[r].label}</option>
                            ))}
                        </Select>

                        {/* Pending Role Approval Actions */}
                        {hasPendingRole && (
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                              Req: {roleReq.requestedRole} ({roleReq.requestedBy})
                            </span>
                            {roleReq.isOwnerToOwner ? (
                              u.id === currentUser.id ? (
                                <div className="flex items-center gap-1.5">
                                  <AcceptBtn onClick={() => approveRoleChange(u, roleReq.requestedRole)} title="Accept Role Change">
                                    Accept
                                  </AcceptBtn>
                                  <RejectBtn onClick={() => rejectRoleChange(u)} title="Reject Role Change">
                                    Reject
                                  </RejectBtn>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-amber-700 italic">
                                    Awaiting {u.name}'s Accept/Reject
                                  </span>
                                  {currentUser.id === roleReq.requestedById && (
                                    <CancelBtn onClick={() => rejectRoleChange(u)} title="Cancel Request">
                                      Cancel
                                    </CancelBtn>
                                  )}
                                </div>
                              )
                            ) : (
                              <div className="flex items-center gap-1.5">
                                {isOwner && (
                                  <>
                                    <AcceptBtn onClick={() => approveRoleChange(u, roleReq.requestedRole)} title="Approve Role">
                                      Approve
                                    </AcceptBtn>
                                    <RejectBtn onClick={() => rejectRoleChange(u)} title="Reject Role Change">
                                      Reject
                                    </RejectBtn>
                                  </>
                                )}
                                {(currentUser.id === roleReq.requestedById || currentUser.name === roleReq.requestedBy || isManager) && (
                                  <CancelBtn onClick={() => rejectRoleChange(u)} title="Cancel Role Request">
                                    Cancel Request
                                  </CancelBtn>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-2.5">
                      {isUserPending ? (
                        <Badge tone="amber">Pending Approval</Badge>
                      ) : (
                        <Badge tone={u.status === "Active" ? "green" : "red"}>{u.status}</Badge>
                      )}
                    </td>

                    {/* Last Login */}
                    <td className="px-4 py-2.5 text-xs" style={{ color: T.inkFaint }}>
                      {lastLogin ? new Date(lastLogin.timestamp).toLocaleString("en-IN") : "Never"}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2.5 text-right">
                      {isUserPending ? (
                        <div className="flex justify-end items-center gap-1.5">
                          {isOwner && (
                            <AcceptBtn onClick={() => approveUser(u)}>
                              Approve User
                            </AcceptBtn>
                          )}
                          <CancelBtn onClick={() => rejectUser(u)} title="Cancel User Creation Request">
                            Cancel Request
                          </CancelBtn>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {pendingMemberAction ? (
                            <div className="flex items-center gap-1.5 text-xs flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-300">
                                Req: {pendingMemberAction.action} ({pendingMemberAction.requestedBy})
                              </span>
                              {pendingMemberAction.isOwnerToOwner ? (
                                u.id === currentUser.id ? (
                                  <div className="flex items-center gap-1.5">
                                    <AcceptBtn onClick={() => approveMemberAction(u, pendingMemberAction)} title="Accept Request">
                                      Accept
                                    </AcceptBtn>
                                    <RejectBtn onClick={() => rejectMemberAction(u, pendingMemberAction)} title="Cancel Request">
                                      Reject
                                    </RejectBtn>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-amber-700 italic">
                                      Awaiting {u.name}'s Accept/Reject
                                    </span>
                                    <CancelBtn onClick={() => rejectMemberAction(u, pendingMemberAction)} title="Cancel Request">
                                      Cancel Request
                                    </CancelBtn>
                                  </div>
                                )
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  {isOwner && (
                                    <AcceptBtn onClick={() => approveMemberAction(u, pendingMemberAction)}>
                                      Approve
                                    </AcceptBtn>
                                  )}
                                  <CancelBtn onClick={() => rejectMemberAction(u, pendingMemberAction)} title="Cancel Action Request">
                                    Cancel Request
                                  </CancelBtn>
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              <Btn
                                size="sm"
                                variant={u.status === "Active" ? "danger" : "secondary"}
                                onClick={() => toggleStatus(u)}
                                disabled={isViewer || u.id === currentUser.id || (isManager && isOwnerRole(u.role))}
                                title={isViewer ? "Viewers cannot modify accounts" : (isManager && isOwnerRole(u.role) ? "Managers cannot modify Owner accounts" : "")}
                              >
                                {u.status === "Active" ? "Deactivate" : "Reactivate"}
                              </Btn>
                              <Btn
                                size="sm"
                                variant="secondary"
                                onClick={() => deleteMember(u)}
                                disabled={isViewer || u.id === currentUser.id || (isManager && isOwnerRole(u.role))}
                                title={isViewer ? "Viewers cannot delete accounts" : (isManager && isOwnerRole(u.role) ? "Managers cannot delete Owner accounts" : "Delete Member")}
                                className="!text-red-600 hover:!bg-red-50"
                              >
                                <Trash2 size={13} />
                              </Btn>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Activity Logs */}
      <div className="text-sm font-semibold mb-2" style={{ color: T.ink }}>Login activity</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {loginEvents.slice(0, 9).map((l) => (
          <Card key={l.id} className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: T.ink }}>{l.userName}</span>
              <Badge tone={l.action === "Login" ? "green" : "neutral"}>{l.action}</Badge>
            </div>
            <div className="text-[11px] mt-1" style={{ color: T.inkFaint }}>
              {l.role} · {new Date(l.timestamp).toLocaleString("en-IN")}
            </div>
          </Card>
        ))}
        {loginEvents.length === 0 && <div className="col-span-3"><EmptyState icon={History} title="No login activity yet" /></div>}
      </div>

      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="text-sm font-semibold" style={{ color: T.ink }}>Full audit trail</div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <Search size={13} color={T.inkFaint} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by user or action…"
            className="outline-none text-xs"
            style={{ color: T.ink }}
          />
        </div>
      </div>
      <Card>
        {filteredLog.length === 0 ? (
          <EmptyState icon={History} title="No activity recorded yet" subtitle="Every login, invoice, payment, and record change made by your team will appear here." />
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Time", "User", "Role", "Action", "Details"].map((h) => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-medium sticky top-0" style={{ color: T.inkFaint, background: T.surface }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLog.map((l) => (
                  <tr key={l.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                    <td className="px-4 py-2 text-xs whitespace-nowrap" style={{ color: T.inkFaint }}>{new Date(l.timestamp).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2 text-xs font-medium" style={{ color: T.ink }}>{l.userName}</td>
                    <td className="px-4 py-2 text-xs" style={{ color: T.inkFaint }}>{l.role}</td>
                    <td className="px-4 py-2 text-xs">
                      <Badge tone={l.action.includes("Fail") || l.action.includes("deactivat") || l.action.includes("reject") ? "red" : l.action.includes("request") ? "amber" : "neutral"}>
                        {l.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-xs" style={{ color: T.inkFaint }}>{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add User / Request User Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={isOwner ? "Add Team Member" : "Request New Team Member"}>
        <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: T.navyWash, color: T.navy }}>
          Enter Email & Password to <b>automatically create the Supabase Auth user</b> via backend API and fill the UID. {isOwner ? "Account will be activated immediately." : "Your request will be submitted to the Owner for approval."}
        </div>
        <div className="space-y-3">
          <Field label="Full name" required>
            <Input allow="alpha" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Team member's full name" />
          </Field>
          <Field label="Email address" required>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@company.com" />
          </Field>
          <Field label="Password" required hint="Initial temporary login password">
            <div className="flex gap-2">
              <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="e.g. Pass1234!" />
              <Btn
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setForm({ ...form, password: "Pass" + Math.floor(100000 + Math.random() * 900000) + "!" })}
              >
                Auto-generate
              </Btn>
            </div>
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.keys(ROLES)
                .filter((r) => isOwner || r !== "Owner")
                .map((r) => (
                  <option key={r} value={r}>{ROLES[r].label}</option>
                ))}
            </Select>
          </Field>
          <Field label="Supabase Auth User ID (UID)" hint="Auto-filled via backend API or enter manually">
            <div className="flex gap-2">
              <Input value={form.authUserId} onChange={(e) => setForm({ ...form, authUserId: e.target.value.trim() })} placeholder="e.g. 8b1c2e4a-..." />
              <Btn
                type="button"
                variant="secondary"
                size="sm"
                disabled={creatingAuth || !form.email || !form.password}
                onClick={() => handleAutoCreateAuthUser()}
              >
                {creatingAuth ? "Creating..." : "⚡ Auto-fill UID"}
              </Btn>
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn>
          <Btn icon={Save} onClick={addUser} disabled={creatingAuth}>
            {creatingAuth ? "Processing..." : (isOwner ? "Add User" : "Submit Request to Owner")}
          </Btn>
        </div>
      </Modal>

      {/* Password Verification Modal */}
      <Modal open={pwdModal.open} onClose={() => setPwdModal({ ...pwdModal, open: false })} title={pwdModal.title}>
        <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: T.amberWash, color: T.amber, border: "1px solid rgba(176,109,0,0.20)" }}>
          {pwdModal.description}
        </div>
        <div className="space-y-3">
          <Field label="Your Current Login Password" required hint="Password verification is required for security">
            <Input
              type="password"
              value={pwdModal.password}
              onChange={(e) => setPwdModal({ ...pwdModal, password: e.target.value, error: "" })}
              placeholder="Enter your current login password"
              onKeyDown={(e) => {
                if (e.key === "Enter" && pwdModal.onConfirm) {
                  pwdModal.onConfirm(pwdModal.password);
                }
              }}
            />
          </Field>
          {pwdModal.error && (
            <div className="text-xs text-red-600 font-semibold px-1">{pwdModal.error}</div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="secondary" onClick={() => setPwdModal({ ...pwdModal, open: false })}>
            Cancel
          </Btn>
          <Btn
            icon={KeyRound}
            onClick={() => pwdModal.onConfirm && pwdModal.onConfirm(pwdModal.password)}
            disabled={pwdModal.loading || !pwdModal.password}
          >
            {pwdModal.loading ? "Verifying..." : "Verify Password & Confirm"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
