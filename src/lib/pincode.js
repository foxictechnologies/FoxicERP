import { INDIAN_STATES } from "./constants.js";

// In-memory cache for fast repeated lookups
const pincodeCache = new Map();

// High-accuracy 3-digit and 2-digit Indian PIN code database
const PINCODE_MAP = {
  // Gujarat
  "370": { state: "Gujarat", city: "Kutch", district: "Kutch" },
  "360": { state: "Gujarat", city: "Rajkot", district: "Rajkot" },
  "361": { state: "Gujarat", city: "Jamnagar", district: "Jamnagar" },
  "362": { state: "Gujarat", city: "Junagadh", district: "Junagadh" },
  "363": { state: "Gujarat", city: "Surendranagar", district: "Surendranagar" },
  "364": { state: "Gujarat", city: "Bhavnagar", district: "Bhavnagar" },
  "365": { state: "Gujarat", city: "Amreli", district: "Amreli" },
  "380": { state: "Gujarat", city: "Ahmedabad", district: "Ahmedabad" },
  "382": { state: "Gujarat", city: "Gandhinagar", district: "Gandhinagar" },
  "383": { state: "Gujarat", city: "Himatnagar", district: "Sabarkantha" },
  "384": { state: "Gujarat", city: "Mehsana", district: "Mehsana" },
  "385": { state: "Gujarat", city: "Palanpur", district: "Banaskantha" },
  "387": { state: "Gujarat", city: "Nadiad", district: "Kheda" },
  "388": { state: "Gujarat", city: "Anand", district: "Anand" },
  "389": { state: "Gujarat", city: "Godhra", district: "Panchmahal" },
  "390": { state: "Gujarat", city: "Vadodara", district: "Vadodara" },
  "391": { state: "Gujarat", city: "Vadodara Rural", district: "Vadodara" },
  "392": { state: "Gujarat", city: "Bharuch", district: "Bharuch" },
  "393": { state: "Gujarat", city: "Ankleshwar", district: "Bharuch" },
  "394": { state: "Gujarat", city: "Surat Rural", district: "Surat" },
  "395": { state: "Gujarat", city: "Surat", district: "Surat" },
  "396": { state: "Gujarat", city: "Valsad / Vapi", district: "Valsad" },

  // Delhi NCR
  "110": { state: "Delhi", city: "Delhi", district: "Delhi" },
  "11": { state: "Delhi", city: "Delhi", district: "Delhi" },
  "201": { state: "Uttar Pradesh", city: "Noida / Ghaziabad", district: "Gautam Buddha Nagar" },
  "121": { state: "Haryana", city: "Faridabad", district: "Faridabad" },
  "122": { state: "Haryana", city: "Gurugram", district: "Gurugram" },

  // Maharashtra
  "400": { state: "Maharashtra", city: "Mumbai", district: "Mumbai" },
  "401": { state: "Maharashtra", city: "Thane / Palghar", district: "Thane" },
  "402": { state: "Maharashtra", city: "Raigad", district: "Raigad" },
  "410": { state: "Maharashtra", city: "Pune Rural / Navi Mumbai", district: "Pune" },
  "411": { state: "Maharashtra", city: "Pune", district: "Pune" },
  "412": { state: "Maharashtra", city: "Pune Suburbs", district: "Pune" },
  "413": { state: "Maharashtra", city: "Solapur", district: "Solapur" },
  "414": { state: "Maharashtra", city: "Ahmednagar", district: "Ahmednagar" },
  "415": { state: "Maharashtra", city: "Satara / Ratnagiri", district: "Satara" },
  "416": { state: "Maharashtra", city: "Kolhapur", district: "Kolhapur" },
  "421": { state: "Maharashtra", city: "Kalyan / Thane", district: "Thane" },
  "422": { state: "Maharashtra", city: "Nashik", district: "Nashik" },
  "423": { state: "Maharashtra", city: "Malegaon", district: "Nashik" },
  "424": { state: "Maharashtra", city: "Dhule", district: "Dhule" },
  "425": { state: "Maharashtra", city: "Jalgaon", district: "Jalgaon" },
  "431": { state: "Maharashtra", city: "Chhatrapati Sambhajinagar", district: "Aurangabad" },
  "440": { state: "Maharashtra", city: "Nagpur", district: "Nagpur" },
  "441": { state: "Maharashtra", city: "Nagpur Rural", district: "Nagpur" },
  "442": { state: "Maharashtra", city: "Chandrapur / Wardha", district: "Chandrapur" },
  "444": { state: "Maharashtra", city: "Amravati / Akola", district: "Amravati" },
  "445": { state: "Maharashtra", city: "Yavatmal", district: "Yavatmal" },

  // Karnataka
  "560": { state: "Karnataka", city: "Bengaluru", district: "Bengaluru" },
  "561": { state: "Karnataka", city: "Bengaluru Rural", district: "Bengaluru Rural" },
  "562": { state: "Karnataka", city: "Ramanagara", district: "Ramanagara" },
  "563": { state: "Karnataka", city: "Kolar", district: "Kolar" },
  "570": { state: "Karnataka", city: "Mysuru", district: "Mysuru" },
  "571": { state: "Karnataka", city: "Mandya", district: "Mandya" },
  "572": { state: "Karnataka", city: "Tumakuru", district: "Tumakuru" },
  "573": { state: "Karnataka", city: "Hassan", district: "Hassan" },
  "574": { state: "Karnataka", city: "Dakshina Kannada", district: "Dakshina Kannada" },
  "575": { state: "Karnataka", city: "Mangaluru", district: "Dakshina Kannada" },
  "576": { state: "Karnataka", city: "Udupi", district: "Udupi" },
  "577": { state: "Karnataka", city: "Shivamogga / Davanagere", district: "Shivamogga" },
  "580": { state: "Karnataka", city: "Hubballi / Dharwad", district: "Dharwad" },
  "581": { state: "Karnataka", city: "Uttara Kannada", district: "Uttara Kannada" },
  "582": { state: "Karnataka", city: "Gadag", district: "Gadag" },
  "583": { state: "Karnataka", city: "Ballari", district: "Ballari" },
  "584": { state: "Karnataka", city: "Raichur", district: "Raichur" },
  "585": { state: "Karnataka", city: "Kalaburagi", district: "Kalaburagi" },
  "586": { state: "Karnataka", city: "Vijayapura", district: "Vijayapura" },
  "587": { state: "Karnataka", city: "Bagalkote", district: "Bagalkote" },
  "590": { state: "Karnataka", city: "Belagavi", district: "Belagavi" },

  // Rajasthan
  "301": { state: "Rajasthan", city: "Alwar", district: "Alwar" },
  "302": { state: "Rajasthan", city: "Jaipur", district: "Jaipur" },
  "303": { state: "Rajasthan", city: "Jaipur Rural", district: "Jaipur" },
  "304": { state: "Rajasthan", city: "Tonk", district: "Tonk" },
  "305": { state: "Rajasthan", city: "Ajmer", district: "Ajmer" },
  "311": { state: "Rajasthan", city: "Bhilwara", district: "Bhilwara" },
  "312": { state: "Rajasthan", city: "Chittorgarh", district: "Chittorgarh" },
  "313": { state: "Rajasthan", city: "Udaipur", district: "Udaipur" },
  "321": { state: "Rajasthan", city: "Bharatpur", district: "Bharatpur" },
  "324": { state: "Rajasthan", city: "Kota", district: "Kota" },
  "331": { state: "Rajasthan", city: "Churu", district: "Churu" },
  "332": { state: "Rajasthan", city: "Sikar", district: "Sikar" },
  "333": { state: "Rajasthan", city: "Jhunjhunu", district: "Jhunjhunu" },
  "334": { state: "Rajasthan", city: "Bikaner", district: "Bikaner" },
  "335": { state: "Rajasthan", city: "Sri Ganganagar", district: "Sri Ganganagar" },
  "341": { state: "Rajasthan", city: "Nagaur", district: "Nagaur" },
  "342": { state: "Rajasthan", city: "Jodhpur", district: "Jodhpur" },
  "344": { state: "Rajasthan", city: "Barmer", district: "Barmer" },
  "345": { state: "Rajasthan", city: "Jaisalmer", district: "Jaisalmer" },

  // Tamil Nadu
  "600": { state: "Tamil Nadu", city: "Chennai", district: "Chennai" },
  "601": { state: "Tamil Nadu", city: "Tiruvallur", district: "Tiruvallur" },
  "602": { state: "Tamil Nadu", city: "Kanchipuram", district: "Kanchipuram" },
  "603": { state: "Tamil Nadu", city: "Chengalpattu", district: "Chengalpattu" },
  "605": { state: "Puducherry", city: "Puducherry", district: "Puducherry" },
  "613": { state: "Tamil Nadu", city: "Thanjavur", district: "Thanjavur" },
  "620": { state: "Tamil Nadu", city: "Tiruchirappalli", district: "Tiruchirappalli" },
  "625": { state: "Tamil Nadu", city: "Madurai", district: "Madurai" },
  "627": { state: "Tamil Nadu", city: "Tirunelveli", district: "Tirunelveli" },
  "628": { state: "Tamil Nadu", city: "Thoothukudi", district: "Thoothukudi" },
  "629": { state: "Tamil Nadu", city: "Nagercoil / Kanyakumari", district: "Kanyakumari" },
  "632": { state: "Tamil Nadu", city: "Vellore", district: "Vellore" },
  "636": { state: "Tamil Nadu", city: "Salem", district: "Salem" },
  "638": { state: "Tamil Nadu", city: "Erode", district: "Erode" },
  "641": { state: "Tamil Nadu", city: "Coimbatore", district: "Coimbatore" },
  "643": { state: "Tamil Nadu", city: "Ooty / Nilgiris", district: "Nilgiris" },

  // Telangana & Andhra Pradesh
  "500": { state: "Telangana", city: "Hyderabad", district: "Hyderabad" },
  "501": { state: "Telangana", city: "Ranga Reddy", district: "Ranga Reddy" },
  "505": { state: "Telangana", city: "Karimnagar", district: "Karimnagar" },
  "506": { state: "Telangana", city: "Warangal", district: "Warangal" },
  "515": { state: "Andhra Pradesh", city: "Anantapur", district: "Anantapur" },
  "517": { state: "Andhra Pradesh", city: "Tirupati", district: "Tirupati" },
  "518": { state: "Andhra Pradesh", city: "Kurnool", district: "Kurnool" },
  "520": { state: "Andhra Pradesh", city: "Vijayawada", district: "NTR" },
  "522": { state: "Andhra Pradesh", city: "Guntur", district: "Guntur" },
  "530": { state: "Andhra Pradesh", city: "Visakhapatnam", district: "Visakhapatnam" },
  "533": { state: "Andhra Pradesh", city: "Kakinada / Rajahmundry", district: "East Godavari" },

  // Madhya Pradesh
  "452": { state: "Madhya Pradesh", city: "Indore", district: "Indore" },
  "456": { state: "Madhya Pradesh", city: "Ujjain", district: "Ujjain" },
  "462": { state: "Madhya Pradesh", city: "Bhopal", district: "Bhopal" },
  "474": { state: "Madhya Pradesh", city: "Gwalior", district: "Gwalior" },
  "482": { state: "Madhya Pradesh", city: "Jabalpur", district: "Jabalpur" },
  "486": { state: "Madhya Pradesh", city: "Rewa", district: "Rewa" },

  // West Bengal
  "700": { state: "West Bengal", city: "Kolkata", district: "Kolkata" },
  "711": { state: "West Bengal", city: "Howrah", district: "Howrah" },
  "713": { state: "West Bengal", city: "Durgapur / Asansol", district: "Paschim Bardhaman" },
  "734": { state: "West Bengal", city: "Siliguri / Darjeeling", district: "Darjeeling" },

  // Bihar & Jharkhand
  "800": { state: "Bihar", city: "Patna", district: "Patna" },
  "812": { state: "Bihar", city: "Bhagalpur", district: "Bhagalpur" },
  "823": { state: "Bihar", city: "Gaya", district: "Gaya" },
  "842": { state: "Bihar", city: "Muzaffarpur", district: "Muzaffarpur" },
  "826": { state: "Jharkhand", city: "Dhanbad", district: "Dhanbad" },
  "831": { state: "Jharkhand", city: "Jamshedpur", district: "East Singhbhum" },
  "834": { state: "Jharkhand", city: "Ranchi", district: "Ranchi" },

  // Uttar Pradesh
  "208": { state: "Uttar Pradesh", city: "Kanpur", district: "Kanpur" },
  "211": { state: "Uttar Pradesh", city: "Prayagraj", district: "Prayagraj" },
  "221": { state: "Uttar Pradesh", city: "Varanasi", district: "Varanasi" },
  "226": { state: "Uttar Pradesh", city: "Lucknow", district: "Lucknow" },
  "243": { state: "Uttar Pradesh", city: "Bareilly", district: "Bareilly" },
  "247": { state: "Uttar Pradesh", city: "Saharanpur", district: "Saharanpur" },
  "250": { state: "Uttar Pradesh", city: "Meerut", district: "Meerut" },
  "273": { state: "Uttar Pradesh", city: "Gorakhpur", district: "Gorakhpur" },
  "281": { state: "Uttar Pradesh", city: "Mathura", district: "Mathura" },
  "282": { state: "Uttar Pradesh", city: "Agra", district: "Agra" },

  // Punjab, Haryana, HP, J&K, Goa, Assam, Odisha, Kerala, etc.
  "141": { state: "Punjab", city: "Ludhiana", district: "Ludhiana" },
  "143": { state: "Punjab", city: "Amritsar", district: "Amritsar" },
  "144": { state: "Punjab", city: "Jalandhar", district: "Jalandhar" },
  "160": { state: "Chandigarh", city: "Chandigarh", district: "Chandigarh" },
  "171": { state: "Himachal Pradesh", city: "Shimla", district: "Shimla" },
  "180": { state: "Jammu and Kashmir", city: "Jammu", district: "Jammu" },
  "190": { state: "Jammu and Kashmir", city: "Srinagar", district: "Srinagar" },
  "403": { state: "Goa", city: "Panaji / Goa", district: "North Goa" },
  "492": { state: "Chhattisgarh", city: "Raipur", district: "Raipur" },
  "751": { state: "Odisha", city: "Bhubaneswar", district: "Khordha" },
  "753": { state: "Odisha", city: "Cuttack", district: "Cuttack" },
  "769": { state: "Odisha", city: "Rourkela", district: "Sundargarh" },
  "781": { state: "Assam", city: "Guwahati", district: "Kamrup" },
  "682": { state: "Kerala", city: "Kochi", district: "Ernakulam" },
  "695": { state: "Kerala", city: "Thiruvananthapuram", district: "Thiruvananthapuram" }
};

function normalizeCityName(district, block, name, division) {
  // Normalize Kutch / Kachchh spellings
  if (district?.toLowerCase().includes("kachchh") || division?.toLowerCase().includes("kutch") || district?.toLowerCase().includes("kutch")) {
    if (block && block.toLowerCase() !== "kachchh" && block.toLowerCase() !== "kutch") {
      return `Kutch (${block})`;
    }
    return "Kutch";
  }

  // Normalize Bangalore / Bengaluru
  if (district?.toLowerCase().includes("bangalore") || district?.toLowerCase().includes("bengaluru")) {
    return "Bengaluru";
  }

  // Normalize Gurgaon / Gurugram
  if (district?.toLowerCase().includes("gurgaon") || district?.toLowerCase().includes("gurugram")) {
    return "Gurugram";
  }

  // Normalize Mumbai
  if (district?.toLowerCase().includes("mumbai")) {
    return "Mumbai";
  }

  // Normalize Delhi
  if (district?.toLowerCase().includes("delhi")) {
    return "Delhi";
  }

  // Default priority: District > Block > Name
  return district || block || name || "";
}

function matchState(rawState) {
  if (!rawState) return "";
  const cleaned = rawState.trim().toLowerCase();

  const found = INDIAN_STATES.find(
    (s) => s.toLowerCase() === cleaned || cleaned.includes(s.toLowerCase()) || s.toLowerCase().includes(cleaned)
  );
  if (found) return found;

  if (cleaned.includes("delhi") || cleaned.includes("nct")) return "Delhi";
  if (cleaned.includes("orissa")) return "Odisha";
  if (cleaned.includes("pondicherry")) return "Puducherry";
  if (cleaned.includes("uttaranchal")) return "Uttarakhand";
  if (cleaned.includes("jammu")) return "Jammu and Kashmir";
  if (cleaned.includes("daman") || cleaned.includes("diu") || cleaned.includes("dadra")) return "Dadra and Nagar Haveli and Daman and Diu";

  return rawState.trim();
}

/**
 * Look up Indian PIN code to fetch City and State
 * @param {string} pin - 6 digit PIN code
 * @returns {Promise<{success: boolean, city: string, state: string, district: string, area: string}>}
 */
export async function lookupPincode(pin) {
  const cleanPin = String(pin || "").replace(/\D/g, "").slice(0, 6);
  if (cleanPin.length !== 6) {
    return { success: false, city: "", state: "", district: "", area: "" };
  }

  // Check cache first
  if (pincodeCache.has(cleanPin)) {
    return pincodeCache.get(cleanPin);
  }

  // 1. Try Live Postal PIN code API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        const state = matchState(po.State);
        const city = normalizeCityName(po.District, po.Block, po.Name, po.Division);
        const district = po.District || "";
        const area = po.Name || "";

        const result = {
          success: true,
          city,
          state,
          district,
          area
        };
        pincodeCache.set(cleanPin, result);
        return result;
      }
    }
  } catch {
    // API failed or timeout -> fallback to high-accuracy offline map
  }

  // 2. High accuracy 3-digit prefix lookup
  const prefix3 = cleanPin.slice(0, 3);
  if (PINCODE_MAP[prefix3]) {
    const item = PINCODE_MAP[prefix3];
    const result = {
      success: true,
      city: item.city,
      state: item.state,
      district: item.district,
      area: item.city
    };
    pincodeCache.set(cleanPin, result);
    return result;
  }

  // 3. 2-digit prefix lookup
  const prefix2 = cleanPin.slice(0, 2);
  if (PINCODE_MAP[prefix2]) {
    const item = PINCODE_MAP[prefix2];
    const result = {
      success: true,
      city: item.city,
      state: item.state,
      district: item.district,
      area: item.city
    };
    pincodeCache.set(cleanPin, result);
    return result;
  }

  return { success: false, city: "", state: "", district: "", area: "" };
}
