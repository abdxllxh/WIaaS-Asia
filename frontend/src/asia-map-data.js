export const ASIA_COUNTRIES = Object.freeze({
    Pakistan: { center: [69.35, 30.38], subregion: 'South Asia', timeZone: 'Asia/Karachi', utcOffset: 5 },
    India: { center: [78.96, 20.59], subregion: 'South Asia', timeZone: 'Asia/Kolkata', utcOffset: 5.5 },
    Bangladesh: { center: [90.36, 23.68], subregion: 'South Asia', timeZone: 'Asia/Dhaka', utcOffset: 6 },
    Afghanistan: { center: [67.71, 33.94], subregion: 'South Asia', timeZone: 'Asia/Kabul', utcOffset: 4.5 },
    Nepal: { center: [84.12, 28.39], subregion: 'South Asia', timeZone: 'Asia/Kathmandu', utcOffset: 5.75 },
    'Sri Lanka': { center: [80.77, 7.87], subregion: 'South Asia', timeZone: 'Asia/Colombo', utcOffset: 5.5 },
    Bhutan: { center: [90.43, 27.51], subregion: 'South Asia', timeZone: 'Asia/Thimphu', utcOffset: 6 },
    Maldives: { center: [73.22, 3.20], subregion: 'South Asia', timeZone: 'Indian/Maldives', utcOffset: 5 },
    China: { center: [104.20, 35.86], subregion: 'East Asia', timeZone: 'Asia/Shanghai', utcOffset: 8 },
    Japan: { center: [138.25, 36.20], subregion: 'East Asia', timeZone: 'Asia/Tokyo', utcOffset: 9 },
    'South Korea': { center: [127.77, 35.91], subregion: 'East Asia', timeZone: 'Asia/Seoul', utcOffset: 9 },
    'North Korea': { center: [127.51, 40.34], subregion: 'East Asia', timeZone: 'Asia/Pyongyang', utcOffset: 9 },
    Mongolia: { center: [103.85, 46.86], subregion: 'East Asia', timeZone: 'Asia/Ulaanbaatar', utcOffset: 8 },
    Kazakhstan: { center: [66.92, 48.02], subregion: 'Central Asia', timeZone: 'Asia/Almaty', utcOffset: 5 },
    Uzbekistan: { center: [64.59, 41.38], subregion: 'Central Asia', timeZone: 'Asia/Tashkent', utcOffset: 5 },
    Kyrgyzstan: { center: [74.77, 41.20], subregion: 'Central Asia', timeZone: 'Asia/Bishkek', utcOffset: 6 },
    Tajikistan: { center: [71.28, 38.86], subregion: 'Central Asia', timeZone: 'Asia/Dushanbe', utcOffset: 5 },
    Turkmenistan: { center: [59.56, 38.97], subregion: 'Central Asia', timeZone: 'Asia/Ashgabat', utcOffset: 5 },
    Singapore: { center: [103.82, 1.35], subregion: 'Southeast Asia', timeZone: 'Asia/Singapore', utcOffset: 8 },
    Thailand: { center: [100.99, 15.87], subregion: 'Southeast Asia', timeZone: 'Asia/Bangkok', utcOffset: 7 },
    Vietnam: { center: [108.28, 14.06], subregion: 'Southeast Asia', timeZone: 'Asia/Ho_Chi_Minh', utcOffset: 7 },
    Indonesia: { center: [117.28, -2.55], subregion: 'Southeast Asia', timeZone: 'Asia/Jakarta', utcOffset: 7 },
    Malaysia: { center: [102.00, 4.21], subregion: 'Southeast Asia', timeZone: 'Asia/Kuala_Lumpur', utcOffset: 8 },
    Philippines: { center: [121.77, 12.88], subregion: 'Southeast Asia', timeZone: 'Asia/Manila', utcOffset: 8 },
    Myanmar: { center: [95.96, 21.92], subregion: 'Southeast Asia', timeZone: 'Asia/Yangon', utcOffset: 6.5 },
    Cambodia: { center: [104.99, 12.57], subregion: 'Southeast Asia', timeZone: 'Asia/Phnom_Penh', utcOffset: 7 },
    Laos: { center: [102.50, 19.86], subregion: 'Southeast Asia', timeZone: 'Asia/Vientiane', utcOffset: 7 },
    Brunei: { center: [114.73, 4.54], subregion: 'Southeast Asia', timeZone: 'Asia/Brunei', utcOffset: 8 },
    'Timor-Leste': { center: [125.73, -8.87], subregion: 'Southeast Asia', timeZone: 'Asia/Dili', utcOffset: 9 },
    Russia: { center: [96.0, 61.5], subregion: 'North Asia', timeZone: 'Asia/Krasnoyarsk', utcOffset: 7 },
    Turkey: { center: [35.24, 38.96], subregion: 'West Asia', timeZone: 'Europe/Istanbul', utcOffset: 3 },
    Azerbaijan: { center: [47.57, 40.14], subregion: 'West Asia', timeZone: 'Asia/Baku', utcOffset: 4 },
    Georgia: { center: [43.35, 42.31], subregion: 'West Asia', timeZone: 'Asia/Tbilisi', utcOffset: 4 },
    Armenia: { center: [45.03, 40.06], subregion: 'West Asia', timeZone: 'Asia/Yerevan', utcOffset: 4 },
    Iran: { center: [53.68, 32.42], subregion: 'West Asia', timeZone: 'Asia/Tehran', utcOffset: 3.5 },
    Iraq: { center: [43.67, 33.22], subregion: 'West Asia', timeZone: 'Asia/Baghdad', utcOffset: 3 },
});

const CITY_TIME_OVERRIDES = Object.freeze({
    'Indonesia|Denpasar': { timeZone: 'Asia/Makassar', utcOffset: 8 },
    'Indonesia|Makassar': { timeZone: 'Asia/Makassar', utcOffset: 8 },
});

const city = (name, country, latitude, longitude, province = 'Major Cities') => ({
    key: `map:${country.toLowerCase().replace(/[^a-z0-9]+/g, '-')}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    city: name,
    country,
    province,
    latitude,
    longitude,
    asian_subregion: ASIA_COUNTRIES[country]?.subregion || 'Asia',
    timeZone: CITY_TIME_OVERRIDES[`${country}|${name}`]?.timeZone || ASIA_COUNTRIES[country]?.timeZone,
    timezone_offset: CITY_TIME_OVERRIDES[`${country}|${name}`]?.utcOffset ?? ASIA_COUNTRIES[country]?.utcOffset ?? 0,
    locationType: 'city',
    mapOnly: true,
});

export const ADDITIONAL_ASIAN_CITIES = Object.freeze([
    city('Chennai', 'India', 13.0827, 80.2707), city('Hyderabad', 'India', 17.3850, 78.4867),
    city('Ahmedabad', 'India', 23.0225, 72.5714), city('Pune', 'India', 18.5204, 73.8567), city('Surat', 'India', 21.1702, 72.8311),
    city('Rajshahi', 'Bangladesh', 24.3745, 88.6042), city('Khulna', 'Bangladesh', 22.8456, 89.5403), city("Cox's Bazar", 'Bangladesh', 21.4272, 92.0058),
    city('Herat', 'Afghanistan', 34.3529, 62.2040), city('Mazar-i-Sharif', 'Afghanistan', 36.7069, 67.1122), city('Jalalabad', 'Afghanistan', 34.4342, 70.4477),
    city('Pokhara', 'Nepal', 28.2096, 83.9856), city('Biratnagar', 'Nepal', 26.4525, 87.2718), city('Lalitpur', 'Nepal', 27.6588, 85.3247),
    city('Kandy', 'Sri Lanka', 7.2906, 80.6337), city('Galle', 'Sri Lanka', 6.0535, 80.2210), city('Jaffna', 'Sri Lanka', 9.6615, 80.0255),
    city('Paro', 'Bhutan', 27.4287, 89.4164), city('Phuntsholing', 'Bhutan', 26.8516, 89.3884), city('Punakha', 'Bhutan', 27.5921, 89.8797),
    city('Addu City', 'Maldives', -0.6301, 73.1586), city('Fuvahmulah', 'Maldives', -0.2988, 73.4240),
    city('Guangzhou', 'China', 23.1291, 113.2644), city('Chengdu', 'China', 30.5728, 104.0668), city('Chongqing', 'China', 29.4316, 106.9123),
    city("Xi'an", 'China', 34.3416, 108.9398), city('Wuhan', 'China', 30.5928, 114.3055), city('Hangzhou', 'China', 30.2741, 120.1551),
    city('Nanjing', 'China', 32.0603, 118.7969), city('Tianjin', 'China', 39.3434, 117.3616), city('Hong Kong', 'China', 22.3193, 114.1694),
    city('Kyoto', 'Japan', 35.0116, 135.7681), city('Nagoya', 'Japan', 35.1815, 136.9066), city('Sapporo', 'Japan', 43.0618, 141.3545),
    city('Fukuoka', 'Japan', 33.5904, 130.4017), city('Hiroshima', 'Japan', 34.3853, 132.4553), city('Yokohama', 'Japan', 35.4437, 139.6380),
    city('Busan', 'South Korea', 35.1796, 129.0756), city('Incheon', 'South Korea', 37.4563, 126.7052), city('Daegu', 'South Korea', 35.8714, 128.6014),
    city('Daejeon', 'South Korea', 36.3504, 127.3845), city('Gwangju', 'South Korea', 35.1595, 126.8526),
    city('Hamhung', 'North Korea', 39.9183, 127.5364), city('Chongjin', 'North Korea', 41.7956, 129.7758), city('Nampo', 'North Korea', 38.7375, 125.4078), city('Wonsan', 'North Korea', 39.1539, 127.4460),
    city('Erdenet', 'Mongolia', 49.0541, 104.0717), city('Darkhan', 'Mongolia', 49.4867, 105.9228), city('Choibalsan', 'Mongolia', 48.0726, 114.5356),
    city('Shymkent', 'Kazakhstan', 42.3417, 69.5901), city('Karaganda', 'Kazakhstan', 49.8064, 73.0855), city('Aktobe', 'Kazakhstan', 50.2839, 57.1660), city('Atyrau', 'Kazakhstan', 47.0945, 51.9238),
    city('Samarkand', 'Uzbekistan', 39.6542, 66.9597), city('Bukhara', 'Uzbekistan', 39.7681, 64.4556), city('Namangan', 'Uzbekistan', 40.9983, 71.6726), city('Andijan', 'Uzbekistan', 40.7821, 72.3442),
    city('Osh', 'Kyrgyzstan', 40.5139, 72.8161), city('Jalal-Abad', 'Kyrgyzstan', 40.9333, 73.0000), city('Karakol', 'Kyrgyzstan', 42.4907, 78.3936),
    city('Khujand', 'Tajikistan', 40.2833, 69.6333), city('Kulob', 'Tajikistan', 37.9146, 69.7845), city('Bokhtar', 'Tajikistan', 37.8364, 68.7803),
    city('Turkmenabat', 'Turkmenistan', 39.0733, 63.5786), city('Mary', 'Turkmenistan', 37.6000, 61.8333), city('Dashoguz', 'Turkmenistan', 41.8363, 59.9666),
    city('Jurong East', 'Singapore', 1.3329, 103.7436), city('Woodlands', 'Singapore', 1.4382, 103.7890), city('Tampines', 'Singapore', 1.3496, 103.9568),
    city('Chiang Mai', 'Thailand', 18.7883, 98.9853), city('Phuket', 'Thailand', 7.8804, 98.3923), city('Pattaya', 'Thailand', 12.9236, 100.8825), city('Khon Kaen', 'Thailand', 16.4322, 102.8236), city('Hat Yai', 'Thailand', 7.0084, 100.4747),
    city('Da Nang', 'Vietnam', 16.0544, 108.2022), city('Hue', 'Vietnam', 16.4637, 107.5909), city('Can Tho', 'Vietnam', 10.0452, 105.7469), city('Hai Phong', 'Vietnam', 20.8449, 106.6881),
    city('Bandung', 'Indonesia', -6.9175, 107.6191), city('Medan', 'Indonesia', 3.5952, 98.6722), city('Makassar', 'Indonesia', -5.1477, 119.4327), city('Denpasar', 'Indonesia', -8.6705, 115.2126), city('Yogyakarta', 'Indonesia', -7.7956, 110.3695), city('Semarang', 'Indonesia', -6.9667, 110.4167),
    city('George Town', 'Malaysia', 5.4141, 100.3288), city('Johor Bahru', 'Malaysia', 1.4927, 103.7414), city('Kuching', 'Malaysia', 1.5533, 110.3592), city('Kota Kinabalu', 'Malaysia', 5.9804, 116.0735), city('Ipoh', 'Malaysia', 4.5975, 101.0901),
    city('Cebu City', 'Philippines', 10.3157, 123.8854), city('Davao City', 'Philippines', 7.1907, 125.4553), city('Quezon City', 'Philippines', 14.6760, 121.0437), city('Baguio', 'Philippines', 16.4023, 120.5960), city('Iloilo City', 'Philippines', 10.7202, 122.5621),
    city('Mandalay', 'Myanmar', 21.9588, 96.0891), city('Naypyidaw', 'Myanmar', 19.7633, 96.0785), city('Bagan', 'Myanmar', 21.1717, 94.8585), city('Mawlamyine', 'Myanmar', 16.4905, 97.6283),
    city('Siem Reap', 'Cambodia', 13.3633, 103.8564), city('Battambang', 'Cambodia', 13.0957, 103.2022), city('Sihanoukville', 'Cambodia', 10.6253, 103.5234),
    city('Luang Prabang', 'Laos', 19.8833, 102.1333), city('Pakse', 'Laos', 15.1202, 105.7989), city('Savannakhet', 'Laos', 16.5560, 104.7500),
    city('Kuala Belait', 'Brunei', 4.5836, 114.1963), city('Seria', 'Brunei', 4.6131, 114.3302), city('Tutong', 'Brunei', 4.8028, 114.6492),
    city('Baucau', 'Timor-Leste', -8.4711, 126.4583), city('Suai', 'Timor-Leste', -9.3129, 125.2565), city('Maliana', 'Timor-Leste', -8.9917, 125.2197),
]);

export const ASIA_LANDMARKS = Object.freeze([
    { name: 'Faisal Mosque', country: 'Pakistan', latitude: 33.7295, longitude: 73.0372 },
    { name: 'Minar-e-Pakistan', country: 'Pakistan', latitude: 31.5925, longitude: 74.3095 },
    { name: 'Mazar-e-Quaid', country: 'Pakistan', latitude: 24.8754, longitude: 67.0409 },
    { name: 'Taj Mahal', country: 'India', latitude: 27.1751, longitude: 78.0421 },
    { name: 'India Gate', country: 'India', latitude: 28.6129, longitude: 77.2295 },
    { name: 'Gateway of India', country: 'India', latitude: 18.9220, longitude: 72.8347 },
    { name: 'Forbidden City', country: 'China', latitude: 39.9163, longitude: 116.3972 },
    { name: 'Great Wall at Badaling', country: 'China', latitude: 40.3599, longitude: 116.0200 },
    { name: 'Terracotta Army', country: 'China', latitude: 34.3841, longitude: 109.2785 },
    { name: 'Tokyo Skytree', country: 'Japan', latitude: 35.7101, longitude: 139.8107 },
    { name: 'Fushimi Inari', country: 'Japan', latitude: 34.9671, longitude: 135.7727 },
    { name: 'Hiroshima Peace Memorial', country: 'Japan', latitude: 34.3955, longitude: 132.4536 },
    { name: 'Gyeongbokgung Palace', country: 'South Korea', latitude: 37.5796, longitude: 126.9770 },
    { name: 'Marina Bay Sands', country: 'Singapore', latitude: 1.2834, longitude: 103.8607 },
    { name: 'Angkor Wat', country: 'Cambodia', latitude: 13.4125, longitude: 103.8670 },
    { name: 'Grand Palace', country: 'Thailand', latitude: 13.7500, longitude: 100.4914 },
    { name: 'Borobudur', country: 'Indonesia', latitude: -7.6079, longitude: 110.2038 },
    { name: 'Petronas Towers', country: 'Malaysia', latitude: 3.1579, longitude: 101.7116 },
    { name: 'Ha Long Bay', country: 'Vietnam', latitude: 20.9101, longitude: 107.1839 },
    { name: 'Shwedagon Pagoda', country: 'Myanmar', latitude: 16.7983, longitude: 96.1495 },
    { name: 'Boudhanath Stupa', country: 'Nepal', latitude: 27.7215, longitude: 85.3620 },
    { name: 'Sigiriya', country: 'Sri Lanka', latitude: 7.9570, longitude: 80.7603 },
    { name: 'Paro Taktsang', country: 'Bhutan', latitude: 27.4919, longitude: 89.3636 },
    { name: 'Registan Square', country: 'Uzbekistan', latitude: 39.6548, longitude: 66.9758 },
]);

export function getAsianCities(registry = {}) {
    const merged = Object.entries(registry)
        .filter(([, item]) => item.asian_subregion
            && item.asian_subregion !== 'Global Benchmarks'
            && item.city
            && (item.locationType || 'city') === 'city'
            && !String(item.city).includes('Region'))
        .map(([key, item]) => ({
            ...item,
            key,
            locationType: 'city',
            mapOnly: Boolean(item.mapOnly),
        }));
    const seen = new Set(merged.map((item) => `${item.country}|${item.city}`.toLowerCase()));
    ADDITIONAL_ASIAN_CITIES.forEach((item) => {
        const identity = `${item.country}|${item.city}`.toLowerCase();
        if (!seen.has(identity)) {
            merged.push(item);
            seen.add(identity);
        }
    });
    return merged;
}
