// ISO 3166-1 alpha-2 countries with display name and emoji flag, plus an
// ISO 639-1 language subset. Kept inline (no extra npm dependency) so the
// list ships with the standalone build.

export interface CountryOption {
  code: string; // ISO 3166-1 alpha-2, uppercase
  name: string;
  flag: string; // Emoji flag, computed once at module load
}

export interface LanguageOption {
  code: string; // ISO 639-1, lowercase
  name: string; // English name
  nativeName?: string;
}

// Emoji flag from the two-letter country code (regional indicator symbols).
function flagFromCode(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join("");
}

const COUNTRY_ENTRIES: Array<[string, string]> = [
  ["AF", "Afghanistan"], ["AL", "Albania"], ["DZ", "Algeria"], ["AS", "American Samoa"], ["AD", "Andorra"],
  ["AO", "Angola"], ["AI", "Anguilla"], ["AQ", "Antarctica"], ["AG", "Antigua and Barbuda"], ["AR", "Argentina"],
  ["AM", "Armenia"], ["AW", "Aruba"], ["AU", "Australia"], ["AT", "Austria"], ["AZ", "Azerbaijan"],
  ["BS", "Bahamas"], ["BH", "Bahrain"], ["BD", "Bangladesh"], ["BB", "Barbados"], ["BY", "Belarus"],
  ["BE", "Belgium"], ["BZ", "Belize"], ["BJ", "Benin"], ["BM", "Bermuda"], ["BT", "Bhutan"],
  ["BO", "Bolivia"], ["BA", "Bosnia and Herzegovina"], ["BW", "Botswana"], ["BR", "Brazil"], ["IO", "British Indian Ocean Territory"],
  ["VG", "British Virgin Islands"], ["BN", "Brunei"], ["BG", "Bulgaria"], ["BF", "Burkina Faso"], ["BI", "Burundi"],
  ["KH", "Cambodia"], ["CM", "Cameroon"], ["CA", "Canada"], ["CV", "Cape Verde"], ["KY", "Cayman Islands"],
  ["CF", "Central African Republic"], ["TD", "Chad"], ["CL", "Chile"], ["CN", "China"], ["CX", "Christmas Island"],
  ["CC", "Cocos (Keeling) Islands"], ["CO", "Colombia"], ["KM", "Comoros"], ["CK", "Cook Islands"], ["CR", "Costa Rica"],
  ["HR", "Croatia"], ["CU", "Cuba"], ["CW", "Curaçao"], ["CY", "Cyprus"], ["CZ", "Czechia"],
  ["CD", "DR Congo"], ["DK", "Denmark"], ["DJ", "Djibouti"], ["DM", "Dominica"], ["DO", "Dominican Republic"],
  ["EC", "Ecuador"], ["EG", "Egypt"], ["SV", "El Salvador"], ["GQ", "Equatorial Guinea"], ["ER", "Eritrea"],
  ["EE", "Estonia"], ["SZ", "Eswatini"], ["ET", "Ethiopia"], ["FK", "Falkland Islands"], ["FO", "Faroe Islands"],
  ["FJ", "Fiji"], ["FI", "Finland"], ["FR", "France"], ["GF", "French Guiana"], ["PF", "French Polynesia"],
  ["GA", "Gabon"], ["GM", "Gambia"], ["GE", "Georgia"], ["DE", "Germany"], ["GH", "Ghana"],
  ["GI", "Gibraltar"], ["GR", "Greece"], ["GL", "Greenland"], ["GD", "Grenada"], ["GP", "Guadeloupe"],
  ["GU", "Guam"], ["GT", "Guatemala"], ["GG", "Guernsey"], ["GN", "Guinea"], ["GW", "Guinea-Bissau"],
  ["GY", "Guyana"], ["HT", "Haiti"], ["HN", "Honduras"], ["HK", "Hong Kong"], ["HU", "Hungary"],
  ["IS", "Iceland"], ["IN", "India"], ["ID", "Indonesia"], ["IR", "Iran"], ["IQ", "Iraq"],
  ["IE", "Ireland"], ["IM", "Isle of Man"], ["IL", "Israel"], ["IT", "Italy"], ["CI", "Ivory Coast"],
  ["JM", "Jamaica"], ["JP", "Japan"], ["JE", "Jersey"], ["JO", "Jordan"], ["KZ", "Kazakhstan"],
  ["KE", "Kenya"], ["KI", "Kiribati"], ["XK", "Kosovo"], ["KW", "Kuwait"], ["KG", "Kyrgyzstan"],
  ["LA", "Laos"], ["LV", "Latvia"], ["LB", "Lebanon"], ["LS", "Lesotho"], ["LR", "Liberia"],
  ["LY", "Libya"], ["LI", "Liechtenstein"], ["LT", "Lithuania"], ["LU", "Luxembourg"], ["MO", "Macao"],
  ["MG", "Madagascar"], ["MW", "Malawi"], ["MY", "Malaysia"], ["MV", "Maldives"], ["ML", "Mali"],
  ["MT", "Malta"], ["MH", "Marshall Islands"], ["MQ", "Martinique"], ["MR", "Mauritania"], ["MU", "Mauritius"],
  ["YT", "Mayotte"], ["MX", "Mexico"], ["FM", "Micronesia"], ["MD", "Moldova"], ["MC", "Monaco"],
  ["MN", "Mongolia"], ["ME", "Montenegro"], ["MS", "Montserrat"], ["MA", "Morocco"], ["MZ", "Mozambique"],
  ["MM", "Myanmar"], ["NA", "Namibia"], ["NR", "Nauru"], ["NP", "Nepal"], ["NL", "Netherlands"],
  ["NC", "New Caledonia"], ["NZ", "New Zealand"], ["NI", "Nicaragua"], ["NE", "Niger"], ["NG", "Nigeria"],
  ["NU", "Niue"], ["NF", "Norfolk Island"], ["KP", "North Korea"], ["MK", "North Macedonia"], ["MP", "Northern Mariana Islands"],
  ["NO", "Norway"], ["OM", "Oman"], ["PK", "Pakistan"], ["PW", "Palau"], ["PS", "Palestine"],
  ["PA", "Panama"], ["PG", "Papua New Guinea"], ["PY", "Paraguay"], ["PE", "Peru"], ["PH", "Philippines"],
  ["PN", "Pitcairn Islands"], ["PL", "Poland"], ["PT", "Portugal"], ["PR", "Puerto Rico"], ["QA", "Qatar"],
  ["CG", "Republic of the Congo"], ["RE", "Réunion"], ["RO", "Romania"], ["RU", "Russia"], ["RW", "Rwanda"],
  ["BL", "Saint Barthélemy"], ["SH", "Saint Helena"], ["KN", "Saint Kitts and Nevis"], ["LC", "Saint Lucia"], ["MF", "Saint Martin"],
  ["PM", "Saint Pierre and Miquelon"], ["VC", "Saint Vincent and the Grenadines"], ["WS", "Samoa"], ["SM", "San Marino"], ["ST", "São Tomé and Príncipe"],
  ["SA", "Saudi Arabia"], ["SN", "Senegal"], ["RS", "Serbia"], ["SC", "Seychelles"], ["SL", "Sierra Leone"],
  ["SG", "Singapore"], ["SX", "Sint Maarten"], ["SK", "Slovakia"], ["SI", "Slovenia"], ["SB", "Solomon Islands"],
  ["SO", "Somalia"], ["ZA", "South Africa"], ["KR", "South Korea"], ["SS", "South Sudan"], ["ES", "Spain"],
  ["LK", "Sri Lanka"], ["SD", "Sudan"], ["SR", "Suriname"], ["SE", "Sweden"], ["CH", "Switzerland"],
  ["SY", "Syria"], ["TW", "Taiwan"], ["TJ", "Tajikistan"], ["TZ", "Tanzania"], ["TH", "Thailand"],
  ["TL", "Timor-Leste"], ["TG", "Togo"], ["TK", "Tokelau"], ["TO", "Tonga"], ["TT", "Trinidad and Tobago"],
  ["TN", "Tunisia"], ["TR", "Turkey"], ["TM", "Turkmenistan"], ["TC", "Turks and Caicos Islands"], ["TV", "Tuvalu"],
  ["UG", "Uganda"], ["UA", "Ukraine"], ["AE", "United Arab Emirates"], ["GB", "United Kingdom"], ["US", "United States"],
  ["UY", "Uruguay"], ["UZ", "Uzbekistan"], ["VU", "Vanuatu"], ["VA", "Vatican City"], ["VE", "Venezuela"],
  ["VN", "Vietnam"], ["WF", "Wallis and Futuna"], ["EH", "Western Sahara"], ["YE", "Yemen"], ["ZM", "Zambia"], ["ZW", "Zimbabwe"],
];

export const COUNTRIES: CountryOption[] = COUNTRY_ENTRIES
  .map(([code, name]) => ({ code, name, flag: flagFromCode(code) }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function findCountry(code?: string): CountryOption | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase();
  return COUNTRIES.find((c) => c.code === upper);
}

const LANGUAGE_ENTRIES: Array<[string, string, string?]> = [
  ["af", "Afrikaans", "Afrikaans"], ["sq", "Albanian", "Shqip"], ["am", "Amharic", "አማርኛ"],
  ["ar", "Arabic", "العربية"], ["hy", "Armenian", "Հայերեն"], ["az", "Azerbaijani", "Azərbaycan"],
  ["eu", "Basque", "Euskara"], ["be", "Belarusian", "Беларуская"], ["bn", "Bengali", "বাংলা"],
  ["bs", "Bosnian", "Bosanski"], ["bg", "Bulgarian", "Български"], ["my", "Burmese", "မြန်မာ"],
  ["ca", "Catalan", "Català"], ["zh", "Chinese", "中文"], ["hr", "Croatian", "Hrvatski"],
  ["cs", "Czech", "Čeština"], ["da", "Danish", "Dansk"], ["nl", "Dutch", "Nederlands"],
  ["en", "English", "English"], ["et", "Estonian", "Eesti"], ["fi", "Finnish", "Suomi"],
  ["fr", "French", "Français"], ["gl", "Galician", "Galego"], ["ka", "Georgian", "ქართული"],
  ["de", "German", "Deutsch"], ["el", "Greek", "Ελληνικά"], ["gu", "Gujarati", "ગુજરાતી"],
  ["ht", "Haitian Creole", "Kreyòl Ayisyen"], ["ha", "Hausa", "Hausa"], ["he", "Hebrew", "עברית"],
  ["hi", "Hindi", "हिन्दी"], ["hu", "Hungarian", "Magyar"], ["is", "Icelandic", "Íslenska"],
  ["ig", "Igbo", "Igbo"], ["id", "Indonesian", "Bahasa Indonesia"], ["ga", "Irish", "Gaeilge"],
  ["it", "Italian", "Italiano"], ["ja", "Japanese", "日本語"], ["jv", "Javanese", "Basa Jawa"],
  ["kn", "Kannada", "ಕನ್ನಡ"], ["kk", "Kazakh", "Қазақ"], ["km", "Khmer", "ខ្មែរ"],
  ["rw", "Kinyarwanda", "Kinyarwanda"], ["ko", "Korean", "한국어"], ["ku", "Kurdish", "Kurdî"],
  ["ky", "Kyrgyz", "Кыргызча"], ["lo", "Lao", "ລາວ"], ["lv", "Latvian", "Latviešu"],
  ["lt", "Lithuanian", "Lietuvių"], ["lb", "Luxembourgish", "Lëtzebuergesch"], ["mk", "Macedonian", "Македонски"],
  ["mg", "Malagasy", "Malagasy"], ["ms", "Malay", "Bahasa Melayu"], ["ml", "Malayalam", "മലയാളം"],
  ["mt", "Maltese", "Malti"], ["mi", "Maori", "Māori"], ["mr", "Marathi", "मराठी"],
  ["mn", "Mongolian", "Монгол"], ["ne", "Nepali", "नेपाली"], ["no", "Norwegian", "Norsk"],
  ["ny", "Nyanja", "Chichewa"], ["or", "Odia", "ଓଡ଼ିଆ"], ["ps", "Pashto", "پښتو"],
  ["fa", "Persian", "فارسی"], ["pl", "Polish", "Polski"], ["pt", "Portuguese", "Português"],
  ["pa", "Punjabi", "ਪੰਜਾਬੀ"], ["ro", "Romanian", "Română"], ["ru", "Russian", "Русский"],
  ["sm", "Samoan", "Gagana Samoa"], ["gd", "Scottish Gaelic", "Gàidhlig"], ["sr", "Serbian", "Српски"],
  ["sn", "Shona", "Shona"], ["sd", "Sindhi", "سنڌي"], ["si", "Sinhala", "සිංහල"],
  ["sk", "Slovak", "Slovenčina"], ["sl", "Slovenian", "Slovenščina"], ["so", "Somali", "Soomaali"],
  ["es", "Spanish", "Español"], ["su", "Sundanese", "Basa Sunda"], ["sw", "Swahili", "Kiswahili"],
  ["sv", "Swedish", "Svenska"], ["tl", "Tagalog", "Tagalog"], ["tg", "Tajik", "Тоҷикӣ"],
  ["ta", "Tamil", "தமிழ்"], ["tt", "Tatar", "Татар"], ["te", "Telugu", "తెలుగు"],
  ["th", "Thai", "ไทย"], ["tr", "Turkish", "Türkçe"], ["tk", "Turkmen", "Türkmen"],
  ["uk", "Ukrainian", "Українська"], ["ur", "Urdu", "اردو"], ["ug", "Uyghur", "ئۇيغۇر"],
  ["uz", "Uzbek", "Oʻzbek"], ["vi", "Vietnamese", "Tiếng Việt"], ["cy", "Welsh", "Cymraeg"],
  ["xh", "Xhosa", "isiXhosa"], ["yi", "Yiddish", "ייִדיש"], ["yo", "Yoruba", "Yorùbá"], ["zu", "Zulu", "isiZulu"],
];

export const LANGUAGES: LanguageOption[] = LANGUAGE_ENTRIES
  .map(([code, name, nativeName]) => ({ code, name, nativeName }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function findLanguage(code?: string): LanguageOption | undefined {
  if (!code) return undefined;
  return LANGUAGES.find((l) => l.code === code.toLowerCase());
}
