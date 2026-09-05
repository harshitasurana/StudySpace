import { UAParser } from 'ua-parser-js';
import axios from 'axios';

export const parseDeviceInfo = (userAgent) => {
  if (!userAgent) return null;
  
  const parser = new UAParser(userAgent);
  return {
    browser: {
      name: parser.getBrowser().name || 'Unknown',
      version: parser.getBrowser().version || 'Unknown'
    },
    os: {
      name: parser.getOS().name || 'Unknown',
      version: parser.getOS().version || 'Unknown'
    },
    device: {
      type: parser.getDevice().type || 'desktop',
      model: parser.getDevice().model || 'Unknown',
      vendor: parser.getDevice().vendor || 'Unknown'
    },
    isMobile: parser.getDevice().type === 'mobile',
    isTablet: parser.getDevice().type === 'tablet'
  };
};

export const getGeoLocation = async (ip) => {
  if (!ip || ip === '127.0.0.1' || ip === '::1') return { city: 'Local', country: 'LAN', isLocal: true };
  
  try {
    const url = `https://ipapi.co/${ip}/json/`;
    const response = await axios.get(url, { timeout: 2000 });
    const { city, country_name: country, latitude: lat, longitude: lng, org } = response.data;
    
    return {
      city: city || 'Unknown',
      country,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      isp: org || 'Unknown',
      accuracy: response.data.accuracy ? parseInt(response.data.accuracy) : null
    };
  } catch (error) {
    console.warn(`Geo lookup failed for IP ${ip}:`, error.message);
    return { city: 'Unavailable', country: 'Unknown', error: error.message };
  }
};

// Batch geo lookup (for reports)
export const batchGeoLookup = async (ips) => {
  const results = {};
  for (const ip of ips.slice(0, 10)) { // Limit 10
    results[ip] = await getGeoLocation(ip);
  }
  return results;
};

export default { parseDeviceInfo, getGeoLocation, batchGeoLookup };

