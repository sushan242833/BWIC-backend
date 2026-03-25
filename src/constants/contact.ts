export const CONTACT_INVESTMENT_RANGE_VALUES = [
  "1cr-2cr",
  "2cr-3cr",
  "3cr-5cr",
  "5cr+",
  "10cr+",
] as const;

export const CONTACT_INVESTMENT_RANGE_OPTIONS = [
  { value: CONTACT_INVESTMENT_RANGE_VALUES[0], label: "1Cr - 2Cr" },
  { value: CONTACT_INVESTMENT_RANGE_VALUES[1], label: "2Cr - 3Cr" },
  { value: CONTACT_INVESTMENT_RANGE_VALUES[2], label: "3Cr - 5Cr" },
  { value: CONTACT_INVESTMENT_RANGE_VALUES[3], label: "5Cr +" },
  { value: CONTACT_INVESTMENT_RANGE_VALUES[4], label: "10 Cr +" },
] as const;

export const CONTACT_PROPERTY_TYPE_VALUES = [
  "residential",
  "commercial",
  "land",
  "development",
] as const;

export const CONTACT_PROPERTY_TYPE_OPTIONS = [
  {
    value: CONTACT_PROPERTY_TYPE_VALUES[0],
    label: "Residential Real Estate",
  },
  {
    value: CONTACT_PROPERTY_TYPE_VALUES[1],
    label: "Commercial Real Estate",
  },
  {
    value: CONTACT_PROPERTY_TYPE_VALUES[2],
    label: "Land Investment",
  },
  {
    value: CONTACT_PROPERTY_TYPE_VALUES[3],
    label: "Real Estate Development Projects",
  },
] as const;

export const NEPAL_PHONE_PATTERN = /^(\+977)?[9][6-9]\d{8}$/;
export const CONTACT_NOTIFICATION_EMPTY_VALUE = "N/A";
