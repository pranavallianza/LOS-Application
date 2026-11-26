'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Home,
  Landmark,
  Plus,
  Share2,
  Trash2,
  User,
} from 'lucide-react';
import LeadDatePicker from './LeadDatePicker';
import { getRetailLookups } from '../services/retail_lead_management';

/*
const verhoeffMultiplication = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const verhoeffPermutation = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

const hasValidAadhaarChecksum = (value) => {
  let checksum = 0;
  const digits = value.split('').reverse().map(Number);

  digits.forEach((digit, index) => {
    checksum = verhoeffMultiplication[checksum][verhoeffPermutation[index % 8][digit]];
  });

  return checksum === 0;
};
*/

const normalizePan = (value) => {
  let pan = '';

  for (const character of value.toUpperCase().replace(/[^A-Z0-9]/g, '')) {
    const position = pan.length;
    const expectedPattern = position < 5 || position === 9 ? /^[A-Z]$/ : /^[0-9]$/;

    if (expectedPattern.test(character)) pan += character;
    if (pan.length === 10) break;
  }

  return pan;
};

const getAgeFromDob = (dateString) => {
  if (!dateString) return '';
  const dob = new Date(dateString);
  if (Number.isNaN(dob.getTime())) return '';

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age;
};

const getTodayInputDate = () => {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const normalizeLookupValue = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const lookupNamesByField = {
  namePrefix: ['Title', 'Name Prefix', 'Salutation'],
  residentialStatus: ['Residential Status'],
  gender: ['Gender'],
  maritalStatus: ['Marital Status'],
  addressType: ['Address Type'],
  loanProductType: ['Loan Product Type', 'Loan Product'],
  loanPurpose: ['Loan Purpose', 'Purpose of Loan'],
  tenureUnit: ['Unit', 'Tenure Unit', 'Tenure'],
  occupation: ['Occupation'],
  employerType: ['Employer Type'],
  employmentType: ['Employment Type'],
  acquisitionChannel: ['Acquisition Channel', 'Lead Acquisition Channel'],
};
const isBasicAadhaarNumber = (value) => /^[0-9]{12}$/.test(value);
const EMAIL_PATTERN = '[^\\s@]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)+[A-Za-z]{2,63}';
const nameHasValidCharacters = (value) => /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u.test(value);
const normalizeTitle = (title) => {
  const value = String(title || '').trim();
  const normalizedTitle = value.toLowerCase().replace(/\.$/, '');
  return { mr: 'Mr.', ms: 'Ms.', mrs: 'Mrs.' }[normalizedTitle] || value;
};
const titleGender = (title) => {
  const normalizedTitle = String(title || '').trim().toLowerCase().replace(/\.$/, '');
  if (normalizedTitle === 'mr') return 'Male';
  if (['ms', 'mrs', 'miss'].includes(normalizedTitle)) return 'Female';
  return '';
};
const creditFacilityFields = {
  existingBankCreditFacilities: [
    ['accountNumber', 'Account Number'],
    ['loanType', 'Loan Type'],
    ['limit', 'Limit'],
    ['emi', 'EMI'],
    ['outstanding', 'Outstanding'],
    ['dpd', 'DPD'],
    ['accountStatus', 'A/c Status'],
  ],
  otherBankCreditFacilities: [
    ['bankName', 'Bank Name'],
    ['accountNumber', 'Account Number'],
    ['loanType', 'Loan Type'],
    ['limit', 'Limit'],
    ['emi', 'EMI'],
    ['outstanding', 'Outstanding'],
  ],
};
const addressFields = [
  ['addressType', 'Address Type'],
  ['flatBuildingName', 'Flat / Building'],
  ['streetRoad', 'Street / Road'],
  ['landmark', 'Landmark'],
  ['city', 'City'],
  ['state', 'State'],
  ['pinCode', 'PIN Code'],
];
const numericCreditFacilityFields = new Set(['limit', 'emi', 'outstanding', 'dpd']);
const getCreditFacilityError = (collection, facility) => {
  const missing = creditFacilityFields[collection]
    .filter(([field]) => !String(facility[field] ?? '').trim())
    .map(([, label]) => label);
  const invalidNumbers = creditFacilityFields[collection]
    .filter(([field]) => numericCreditFacilityFields.has(field))
    .filter(([field]) => {
      const value = String(facility[field] ?? '').trim();
      const numberPattern = field === 'dpd' ? /^\d+$/ : /^\d+(?:\.\d{1,2})?$/;
      return value && (!numberPattern.test(value) || !Number.isFinite(Number(value)));
    })
    .map(([, label]) => label);

  if (!missing.length && !invalidNumbers.length) return '';
  return [
    missing.length ? `Complete ${missing.join(', ')}.` : '',
    invalidNumbers.length ? `Enter valid non-negative numbers for ${invalidNumbers.join(', ')}.` : '',
  ].filter(Boolean).join(' ');
};
const getAddressError = (address) => {
  return addressFields
    .map(([field, label]) => getAddressFieldError(field, address[field], label))
    .filter(Boolean)
    .join(' ');
};
const getAddressFieldError = (field, value, label) => {
  const text = String(value ?? '').trim();
  if (!text) return `${label} is required.`;
  if (field === 'pinCode' && !/^\d{6}$/.test(text)) return 'Enter a valid 6-digit PIN code.';
  if (['city', 'state', 'addressType'].includes(field) && !/^[\p{L}\p{M}]+(?:[ .'-][\p{L}\p{M}]+)*$/u.test(text)) {
    return `Enter a valid ${label.toLowerCase()} using letters, spaces, hyphens, or apostrophes.`;
  }
  if (['flatBuildingName', 'streetRoad', 'landmark'].includes(field) && !/^[\p{L}\p{M}0-9]+(?:[ .,'#/-][\p{L}\p{M}0-9]+)*$/u.test(text)) {
    return `Enter a valid ${label.toLowerCase()}.`;
  }
  if (text.length > (field === 'streetRoad' ? 150 : 100)) return `${label} must be no more than ${field === 'streetRoad' ? 150 : 100} characters.`;
  return '';
};
const addressFieldAriaLabels = {
  addressType: 'type',
  flatBuildingName: 'flat or building',
  streetRoad: 'street or road',
  landmark: 'landmark',
  city: 'city',
  state: 'state',
  pinCode: 'PIN code',
};
const focusInvalidAddressField = (index, address) => {
  const [field] = addressFields.find(([key, label]) => getAddressFieldError(key, address[key], label)) || [];
  if (!field) return;
  document.querySelectorAll('.lead-address-row')[index]
    ?.querySelector(`[aria-label="Address ${index + 1} ${addressFieldAriaLabels[field]}"]`)
    ?.focus();
};
const createAddressDetailsRow = () => ({
  addressType: '',
  flatBuildingName: '',
  streetRoad: '',
  landmark: '',
  city: '',
  state: '',
  pinCode: '',
});
const createCreditFacilityRow = () => ({
  bankName: '',
  accountNumber: '',
  loanType: '',
  limit: '',
  emi: '',
  outstanding: '',
  dpd: '',
  accountStatus: '',
  statementRequested: false,
});

const getCustomerTypeFromAge = (age) => {
  if (age === '' || age === null || Number.isNaN(Number(age))) return '';
  if (Number(age) < 18) return 'Minor';
  if (Number(age) >= 60) return 'Senior Citizen';
  return 'Normal';
};

const initialForm = {
  namePrefix: '',
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  passportExpiryDate: '',
  age: '',
  customerType: '',
  mobileNumber: '',
  email: '',
  otpNumber: '',
  panOtpNumber: '',
  otpSent: false,
  panCard: '',
  aadhaarCard: '',
  branch: '',
  addressDetails: [createAddressDetailsRow()],
  residentialStatus: '',
  gender: '',
  maritalStatus: '',
  passportNo: '',
  dependents: '',
  loanProductType: '',
  loanAmount: '',
  emiBounce: '',
  noOfBounce: '',
  interestRate: '',
  loanPurpose: '',
  otherLoanPurpose: '',
  securityAmount: '',
  tenure: '',
  tenureUnit: '',
  instalments: '',
  collateral: '',
  employmentType: '',
  occupation: '',
  employerType: '',
  yearsOfService: '',
  incomeSource: '',
  annualIncome: '',
  designation: '',
  employerName: '',
  empEmailId: '',
  location: '',
  state: '',
  takeHomePay: '',
  deductions: '',
  bankName: '',
  primaryBankAccount: '',
  existingBankCreditFacilities: [createCreditFacilityRow()],
  otherBankCreditFacilities: [createCreditFacilityRow()],
  acquisitionChannel: '',
  referralDate: '',
  partnerId: '',
  partnerName: '',
  employeeId: '',
  employeeName: '',
  status: 'Pending',
};

const getLeadFormValues = (lead) => {
  if (!lead) return initialForm;

  const rawNameParts = String(lead.customerName || lead.name || '').trim().split(/\s+/).filter(Boolean);
  const inferredTitle = /^(mr\.?|mrs\.?|ms\.?|miss|dr\.?)$/i.test(rawNameParts[0] || '') ? rawNameParts[0] : '';
  const title = normalizeTitle(lead.namePrefix || lead.title || inferredTitle);
  const nameParts = inferredTitle && !lead.namePrefix && !lead.title ? rawNameParts.slice(1) : rawNameParts;
  const loanPurposeValue = lead.loanPurpose || lead.purposeOfLoan || '';
  return {
    ...initialForm,
    ...lead,
    namePrefix: title,
    gender: titleGender(title) || lead.gender || '',
    firstName: lead.firstName || nameParts[0] || '',
    middleName: lead.middleName || (nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : ''),
    lastName: lead.lastName || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''),
    mobileNumber: lead.mobileNumber || lead.mobile || '',
    email: lead.email || lead.emailAddress || '',
    panCard: lead.panCard || lead.panNumber || '',
    aadhaarCard: lead.aadhaarCard || lead.aadhaarNumber || '',
    branch: lead.branch || lead.branchName || '',
    addressDetails: Array.isArray(lead.addressDetails)
      ? lead.addressDetails.map((address) => ({ ...createAddressDetailsRow(), ...address }))
      : initialForm.addressDetails.map((address) => ({ ...address })),
    passportNo: lead.passportNo || lead.passportNumber || '',
    dependents: lead.dependents ?? lead.numberOfDependents ?? '',
    loanProductType: lead.loanProductType || lead.product || '',
    loanAmount: lead.loanAmount || String(lead.amount || '').replace(/,/g, ''),
    emiBounce: lead.emiBounce ?? '',
    noOfBounce: lead.noOfBounce ?? '',
    loanPurpose: loanPurposeValue,
    otherLoanPurpose: lead.otherLoanPurpose || '',
    employmentType: lead.employmentType === 'Employee' ? 'Salaried' : lead.employmentType || '',
    instalments: lead.instalments ?? lead.numberOfInstalments ?? '',
    monthlyEmi: lead.monthlyEmi ?? lead.emi ?? '',
    collateral: lead.collateral ?? lead.downPaymentCollateral ?? '',
    occupation: lead.occupation || '',
    employerType: lead.employerType || '',
    yearsOfService: lead.yearsOfService ?? '',
    annualIncome: lead.annualIncome ?? '',
    empEmailId: lead.empEmailId || '',
    incomeSource: lead.incomeSource || lead.income_source || '',
    existingBankCreditFacilities: Array.isArray(lead.existingBankCreditFacilities)
      ? lead.existingBankCreditFacilities.map((facility) => ({ ...createCreditFacilityRow(), ...facility }))
      : Array.isArray(lead.creditFacilities)
        ? lead.creditFacilities.map((facility) => ({ ...createCreditFacilityRow(), ...facility }))
        : initialForm.existingBankCreditFacilities.map((facility) => ({ ...facility })),
    otherBankCreditFacilities: Array.isArray(lead.otherBankCreditFacilities)
      ? lead.otherBankCreditFacilities.map((facility) => ({ ...createCreditFacilityRow(), ...facility }))
      : initialForm.otherBankCreditFacilities.map((facility) => ({ ...facility })),
    takeHomePay: lead.takeHomePay ?? '',
    deductions: lead.deductions ?? lead.deductionsOrEmisPayable ?? '',
    primaryBankAccount: lead.primaryBankAccount || lead.accountNumber || '',
    acquisitionChannel: lead.acquisitionChannel || lead.source || '',
    referralDate: lead.referralDate || lead.date || '',
    partnerId: lead.partnerId || lead.sourcingAgentPartnerId || '',
    partnerName: lead.partnerName || lead.agentPartnerName || '',
    status: lead.status || 'Pending',
  };
};

const steps = [
  { title: 'Personal Details', icon: User },
  { title: 'Address Details', icon: Home },
  { title: 'Loan Details', icon: Landmark },
  { title: 'Income Profile', icon: Briefcase },
  { title: 'Referral Details', icon: Share2 },
];
const newLeadInlineStyles = `
.lead-full-page{padding:22px 24px 32px;color:#20383a}
.lead-full-page .lead-page-content{display:flex;flex-direction:column;width:100%;min-height:0}
.lead-full-page .lead-modal-header{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px 24px;background:#fff}
.lead-full-page .lead-modal-header h1{margin:0;color:#23474c;font:700 23px Manrope}
.lead-full-page .lead-modal-header p{margin:5px 0 0;color:#718284;font-size:11px;line-height:1.5}
.lead-full-page .lead-modal-close{display:grid;place-items:center;flex:none;width:34px;height:34px;border:1px solid #dbe5e2;border-radius:5px;background:#fff;color:#53696b;cursor:pointer}
.lead-full-page .lead-modal-close:hover{background:#f2f7f5;color:#176e67}
.lead-full-page .lead-form{display:block;min-height:0;overflow:visible;padding:0}
.lead-full-page .lead-onboarding-card{flex:1;padding:18px 26px 28px}
.lead-full-page .loan-stepper{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:8px;border:1px solid #e4ece9;border-radius:12px;background:#f7faf8}
.lead-full-page .loan-step{min-width:0;min-height:50px;justify-content:flex-start;padding:8px 10px;border:1px solid transparent;border-radius:8px;background:transparent;cursor:pointer}
.lead-full-page .loan-step:disabled{cursor:default;opacity:.72}
.lead-full-page .loan-step.active{border-color:#c8e1d5;background:#fff;box-shadow:0 2px 8px rgba(29,59,48,.06);opacity:1}
.lead-full-page .loan-step.done{color:#267055;opacity:1}
.lead-full-page .loan-step-bubble{flex-basis:28px;width:28px;height:28px;border-color:#ccdad5;color:#59756c}
.lead-full-page .loan-step.active .loan-step-bubble{border-color:#368262;background:#368262;color:#fff;box-shadow:none}
.lead-full-page .loan-step-text{display:inline;white-space:normal;text-align:left;line-height:1.3;font-size:11px}
.lead-full-page .loan-step:not(:last-child)::after{display:none}
.lead-full-page .lead-step-panel{min-width:0;padding:0}
.lead-full-page .lead-step-panel>h2{margin:0 0 22px;padding-bottom:14px;border-bottom:1px solid #e9efed;color:#1d3b48;font:700 23px Manrope}
.lead-full-page .lead-personal-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:start;gap:15px 16px}
.lead-full-page .lead-name-combo{display:grid;grid-template-columns:76px minmax(0,1fr);align-items:end;gap:8px;min-width:0}
.lead-full-page .lead-personal-demographics{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) minmax(72px,.42fr) minmax(0,1fr);gap:15px;width:min(100%,780px)}
.lead-full-page .lead-personal-demographics .lead-calendar-picker .lead-date-picker-trigger{box-sizing:border-box;width:100%;height:48px;min-height:48px;padding:0 14px;border:1px solid #d7e1e4;border-radius:8px;background:#f8fbfc;color:#1d3b48;font:inherit;font-size:13px}
.lead-full-page .lead-personal-demographics .lead-calendar-picker .lead-date-picker-trigger:focus-visible{border-color:#7ea2d9;outline:none;box-shadow:0 0 0 4px rgba(80,130,216,.08)}
.lead-full-page .lead-personal-actions{grid-column:1/-1;display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px}
.lead-full-page .lead-field{display:flex;min-width:0;flex-direction:column;gap:7px;color:#425a57;font-size:11px;font-weight:650}
.lead-full-page .lead-field span em{color:#bb4646;font-style:normal}
.lead-full-page .lead-step-panel input,.lead-full-page .lead-step-panel select{box-sizing:border-box;width:100%;min-width:0;height:44px;min-height:44px;padding:0 13px;border:1px solid #d8e2df;border-radius:8px;background:#fff;color:#1d3b48;font:inherit;font-size:13px;outline:none;transition:border-color .15s,box-shadow .15s}
.lead-full-page .lead-step-panel input:focus,.lead-full-page .lead-step-panel select:focus{border-color:#7ea2d9;box-shadow:0 0 0 4px rgba(80,130,216,.08)}
.lead-full-page .lead-step-panel input:disabled,.lead-full-page .lead-step-panel select:disabled{background:#f1f5f4;color:#839291;cursor:not-allowed;opacity:1}
.lead-full-page .lead-step-panel input[aria-invalid=true]{border-color:#bd4848;background:#fffafa}
.lead-full-page .lead-step-panel input[readonly]{background:#f4f7f6;color:#66797a}
.lead-full-page .lead-computed-field{background:#f4f7f6!important}
.lead-full-page .lead-personal-demographics input{height:48px}
.lead-full-page .lead-personal-actions button,.lead-full-page .lead-verify-button,.lead-full-page .lead-otp-verify,.lead-full-page .lead-income-consent{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:0 11px;border:1px solid #cbded9;border-radius:5px;background:#f3f8f6;color:#226b62;font-size:10px;font-weight:700;cursor:pointer}
.lead-full-page .lead-personal-actions button:hover,.lead-full-page .lead-verify-button:hover,.lead-full-page .lead-otp-verify:hover,.lead-full-page .lead-income-consent:hover{background:#e7f2ee}
.lead-full-page .lead-identity-field,.lead-full-page .lead-otp-field{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:8px;min-width:0}
.lead-full-page .lead-inline-hint,.lead-full-page .lead-otp-message{grid-column:1/-1;margin:0;color:#718284;font-size:10px;font-weight:500;line-height:1.45}
.lead-full-page .lead-inline-hint-error{color:#aa3b3b}
.lead-full-page .lead-otp-field{grid-template-columns:minmax(0,1fr) auto}
.lead-full-page .lead-otp-verify:disabled{cursor:not-allowed;opacity:.55}
.lead-full-page .lead-step-panel>div[style*="grid-template-columns"]{gap:15px 16px!important}
.lead-full-page .lead-income-content{display:grid;gap:18px}
.lead-full-page .lead-income-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:14px}
.lead-full-page .lead-income-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.lead-full-page .lead-income-actions button{min-height:42px;padding:7px;border:1px solid #d8e4e1;border-radius:5px;background:#f7faf9;color:#53696b;font-size:10px;font-weight:650;line-height:1.3}
.lead-full-page .lead-referral-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:14px 16px}
.lead-full-page .lead-referral-grid .lead-field input,.lead-full-page .lead-referral-grid .lead-field select{width:100%;height:44px;min-height:44px;padding:0 13px;border:1px solid #d8e2df;border-radius:8px;background:#fff;color:#1d3b48;font-size:13px}
.lead-full-page .lead-referral-grid .lead-referral-date input[type=date]{display:block;box-sizing:border-box;width:100%;min-width:0;max-width:100%;padding:0 8px}
.lead-full-page .lead-referral-partner-name{max-width:250px}
.lead-full-page .lead-data-table-wrap{max-width:100%;overflow-x:auto}
.lead-full-page .lead-data-table{width:100%;min-width:880px;border-collapse:collapse;border:1px solid #dbe2e6;background:#fff}
.lead-full-page .lead-data-table th,.lead-full-page .lead-data-table td{padding:10px 12px;border:1px solid #dfe6ea;text-align:left;vertical-align:middle;font-size:12px;color:#2e4652}
.lead-full-page .lead-data-table th{background:#f3f7f8;font-weight:700}
.lead-full-page .lead-data-table tbody tr:nth-child(even){background:#fafcfd}
.lead-full-page .lead-data-table td input{width:100%;min-width:100px;min-height:38px;height:38px;padding:0 8px;border:1px solid #dfe8eb;border-radius:6px;background:#fff;color:#224250}
.lead-full-page .lead-data-table td button{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:32px;padding:0 8px;border:1px solid #d8e3e8;border-radius:6px;background:#f5f9fa;color:#31505d;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap}
.lead-full-page .lead-data-table td button:hover{background:#edf5f4}
.lead-full-page .lead-income-content .lead-income-table-wrap{max-width:100%;overflow:hidden}
.lead-full-page .lead-income-content .lead-income-table{width:100%;min-width:0;table-layout:fixed}
.lead-full-page .lead-income-content .lead-income-table th,.lead-full-page .lead-income-content .lead-income-table td{padding:7px 5px;font-size:10px;overflow-wrap:anywhere}
.lead-full-page .lead-income-content .lead-income-table th:first-child,.lead-full-page .lead-income-content .lead-income-table td:first-child{width:6%;text-align:center}
.lead-full-page .lead-income-content .lead-income-table td input{box-sizing:border-box;min-width:0;width:100%;height:34px;min-height:34px;padding:0 4px;font-size:10px}
.lead-full-page .lead-table-section{display:grid;gap:10px;min-width:0}
.lead-full-page .lead-table-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
.lead-full-page .lead-table-heading h4{margin:0;color:#315456;font-size:12px;font-weight:750}
.lead-full-page .lead-table-add{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;padding:0 10px;border:1px solid #cbded9;border-radius:5px;background:#f3f8f6;color:#226b62;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap}
.lead-full-page .lead-address-content,.lead-full-page .lead-credit-content{display:grid;gap:18px}
.lead-full-page .lead-address-rows{display:grid;gap:14px}
.lead-full-page .lead-address-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:15px 16px;padding:16px;border:1px solid #dfe6ea;border-radius:8px;background:#fff}
.lead-full-page .lead-address-row .lead-address-street{grid-column:auto;width:100%}
.lead-full-page .lead-address-row>button{display:inline-flex;align-items:center;justify-content:center;justify-self:start;min-height:38px;padding:0 10px;border:1px solid #d8e3e8;border-radius:6px;background:#f5f9fa;color:#31505d;cursor:pointer}
.lead-full-page .lead-address-row>button:hover{background:#edf5f4}
.lead-full-page .lead-submit-error{margin:0 0 14px;padding:10px 12px;border:1px solid #efcaca;border-radius:5px;background:#fff5f5;color:#9d3030;font-size:12px;line-height:1.45}
.lead-full-page .lead-modal-footer{display:flex;justify-content:flex-end;gap:12px;margin-top:auto;padding-top:28px}
.lead-full-page .loan-form-actions{flex-direction:row;justify-content:space-between;padding-top:28px;gap:12px}
.lead-full-page .loan-form-actions .loan-back-button,.lead-full-page .loan-form-actions .loan-continue-button{height:46px;min-width:130px;padding:0 16px;border-radius:8px;font-size:13px}
@media(max-width:920px){.lead-full-page .loan-form-actions{flex-direction:row}}
@media(max-width:760px){.lead-full-page .loan-stepper{display:flex;overflow-x:auto;gap:6px;padding:6px}.lead-full-page .loan-step{flex:0 0 auto;min-width:132px;gap:6px;padding:7px}.lead-full-page .lead-step-text{font-size:10px}}
@media(max-width:760px){.lead-full-page{padding:14px 16px 24px}.lead-full-page .lead-page-content{width:100%}.lead-full-page .lead-onboarding-card{padding:14px 14px 20px}.lead-full-page .loan-stepper{gap:8px}.lead-full-page .loan-step{gap:6px}.lead-full-page .loan-step:not(:last-child)::after{width:12px;margin-left:4px}.lead-full-page .loan-step-text{font-size:10px}.lead-full-page .lead-personal-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.lead-full-page .lead-personal-demographics{grid-template-columns:minmax(0,1.2fr) minmax(65px,.5fr) minmax(0,1fr);gap:10px}.lead-full-page .lead-income-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.lead-full-page .lead-referral-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.lead-full-page .lead-income-actions{grid-template-columns:repeat(2,minmax(0,1fr))}.lead-full-page .lead-address-row{grid-template-columns:repeat(2,minmax(0,1fr))}.lead-full-page .lead-income-table th,.lead-full-page .lead-income-table td{padding:5px 2px;font-size:9px}.lead-full-page .lead-income-table td input{height:30px;min-height:30px;padding:0 2px;font-size:9px}.lead-full-page .lead-modal-footer{flex-direction:row;flex-wrap:wrap;justify-content:flex-end}.lead-full-page .lead-modal-footer button{width:auto}}
@media(max-width:480px){.lead-full-page .lead-personal-grid,.lead-full-page .lead-referral-grid,.lead-full-page .lead-income-grid,.lead-full-page .lead-address-row{grid-template-columns:1fr}.lead-full-page .lead-name-combo{grid-template-columns:70px minmax(0,1fr)}.lead-full-page .lead-personal-demographics{grid-template-columns:1fr;width:100%}.lead-full-page .lead-personal-demographics,.lead-full-page .lead-identity-field{grid-column:1}.lead-full-page .lead-personal-actions{grid-column:1;justify-content:stretch}.lead-full-page .lead-personal-actions button{flex:1}.lead-full-page .lead-income-grid .lead-income-employer{grid-column:auto}.lead-full-page .lead-modal-footer{flex-wrap:wrap}.lead-full-page .lead-save-btn,.lead-full-page .lead-previous-btn{flex:1}.lead-full-page .lead-mobile-field,.lead-full-page .lead-identity-field,.lead-full-page .lead-otp-field{grid-template-columns:1fr}.lead-full-page .lead-verify-button,.lead-full-page .lead-otp-verify{width:100%}}
.lead-full-page{min-height:100vh;background:#f6f9f8;color:#233c3a}
.lead-full-page>.loan-onboarding-heading{max-width:1320px;margin:0 auto 18px!important}
.lead-full-page .lead-page-content{max-width:1320px;margin:0 auto}
.lead-full-page .loan-application-card.lead-onboarding-card{padding:20px 30px 24px;border:1px solid #d5e2de;border-radius:12px;background:#fff;box-shadow:0 8px 26px rgba(28,66,55,.045)}
.lead-full-page .loan-stepper{display:flex;align-items:center;gap:8px;overflow-x:auto;margin:0 0 20px;padding:5px 0 16px;border:0;border-bottom:1px solid #dce7e3;border-radius:0;background:transparent;scrollbar-width:thin}
.lead-full-page .loan-step{display:inline-flex;flex:0 0 auto;align-items:center;gap:7px;min-height:36px;padding:5px 11px;border:1px solid #d9e4e0;border-radius:999px;background:#fff;color:#5a716c;opacity:1}
.lead-full-page .loan-step:disabled{opacity:.68}
.lead-full-page .loan-step.active{border-color:#128277;background:#eaf6f3;color:#08776e;box-shadow:none}
.lead-full-page .loan-step.done{border-color:#b9d8cd;background:#f3faf7;color:#267055}
.lead-full-page .loan-step-bubble{flex:0 0 22px;width:22px;height:22px;border-color:#d3e2dd;background:#fff;color:#168277}
.lead-full-page .loan-step.active .loan-step-bubble{border-color:#128277;background:#128277;color:#fff}
.lead-full-page .loan-step-text{font-size:11px;font-weight:650;white-space:nowrap}
.lead-full-page .lead-step-panel>h2{margin:0 0 18px;padding:0 0 12px;border-bottom:1px solid #dce7e3;color:#183b3b;font-size:17px;font-weight:700;line-height:1.35}
.lead-full-page .lead-personal-grid{grid-template-columns:repeat(4,minmax(0,1fr));align-items:start;gap:16px 20px}
.lead-full-page .lead-personal-grid>.lead-name-combo{display:contents}
.lead-full-page .lead-personal-grid>.lead-field,.lead-full-page .lead-personal-grid>.lead-identity-field,.lead-full-page .lead-personal-grid>.lead-otp-field{grid-column:span 2}
.lead-full-page .lead-personal-grid>.lead-name-combo>.lead-field{grid-column:auto}
.lead-full-page .lead-personal-demographics{width:100%;max-width:none;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.lead-full-page .lead-personal-actions{grid-column:3/5;grid-row:2;align-self:end;justify-content:flex-end;align-items:center}
.lead-full-page .lead-field{gap:6px;color:#405b57;font-size:11px;font-weight:650}
.lead-full-page .lead-step-panel input,.lead-full-page .lead-step-panel select{box-sizing:border-box;height:40px;min-height:40px;border-color:#d4e0dc;border-radius:6px;background:#fff;font-size:12px}
.lead-full-page .lead-step-panel input:focus,.lead-full-page .lead-step-panel select:focus{border-color:#16877b;box-shadow:0 0 0 3px rgba(22,135,123,.12)}
.lead-full-page .lead-step-panel input[readonly],.lead-full-page .lead-computed-field{border-color:#59635f;background:#fff!important;color:#60736e}
.lead-full-page .lead-personal-demographics .lead-calendar-picker .lead-date-picker-trigger{height:40px;min-height:40px;padding:0 12px;border-color:#d4e0dc;border-radius:6px;background:#fff;font-size:12px}
.lead-full-page .lead-identity-field,.lead-full-page .lead-otp-field{grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end}
.lead-full-page .lead-personal-actions button,.lead-full-page .lead-verify-button,.lead-full-page .lead-otp-verify,.lead-full-page .lead-income-consent{min-height:34px;padding:0 12px;border-color:#b9d8d1;border-radius:6px;background:#eef7f4;color:#14766c;font-size:11px}
.lead-full-page .lead-personal-actions button:hover,.lead-full-page .lead-verify-button:hover,.lead-full-page .lead-otp-verify:hover,.lead-full-page .lead-income-consent:hover{background:#e2f1ec}
.lead-full-page .lead-address-row{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;padding:18px;border-color:#e0e9e6;border-radius:9px;background:#fbfdfc}
.lead-full-page .lead-address-row .lead-address-street{grid-column:auto}
.lead-full-page .lead-address-content,.lead-full-page .lead-credit-content,.lead-full-page .lead-income-content{gap:20px}
.lead-full-page .lead-income-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px 20px}
.lead-full-page .lead-referral-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 20px}
.lead-full-page .lead-referral-grid .lead-referral-partner-name{max-width:none}
.lead-full-page .lead-step-panel>div[style*="grid-template-columns: repeat(2"]{gap:16px 20px!important}
.lead-full-page .lead-step-panel>div[style*="grid-template-columns: 1fr 120px"]{grid-template-columns:minmax(0,1fr) 120px!important}
.lead-full-page .lead-table-section{gap:12px;padding:16px;border:1px solid #e0e9e6;border-radius:9px;background:#fff}
.lead-full-page .lead-table-heading h4{color:#315653;font-size:13px}
.lead-full-page .lead-table-add{min-height:34px;border-radius:6px;font-size:11px}
.lead-full-page .lead-data-table{border-color:#e0e8e5;border-radius:6px}
.lead-full-page .lead-data-table th,.lead-full-page .lead-data-table td{padding:9px 10px;border-color:#e5ece9;font-size:11px}
.lead-full-page .lead-data-table th{background:#f3f8f6;color:#4b6560}
.lead-full-page .lead-data-table td input{box-sizing:border-box;min-height:34px;height:34px;border-radius:5px;font-size:11px}
.lead-full-page .lead-income-content .lead-income-table th,.lead-full-page .lead-income-content .lead-income-table td{padding:7px 5px;font-size:10px}
.lead-full-page .lead-modal-footer{justify-content:space-between;align-items:center;margin-top:22px;padding-top:16px;border-top:1px solid #e2ebe7}
.lead-full-page .loan-form-actions .loan-back-button,.lead-full-page .loan-form-actions .loan-continue-button{height:38px;min-width:104px;border-radius:6px;font-size:12px}
.lead-full-page .loan-form-actions .loan-continue-button{border-color:#117d73;background:#117d73;box-shadow:none}
.lead-full-page .loan-form-actions .loan-back-button{border-color:#d4e0dc;background:#fff;color:#47615c}
@media(max-width:900px){.lead-full-page>.loan-onboarding-heading,.lead-full-page .lead-page-content{max-width:100%}.lead-full-page .loan-application-card.lead-onboarding-card{padding:20px 26px 22px}.lead-full-page .lead-step-panel{padding:0 6px}.lead-full-page .lead-personal-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.lead-full-page .lead-personal-grid>.lead-name-combo{display:grid;grid-column:1/-1;grid-template-columns:72px minmax(0,1fr)}.lead-full-page .lead-personal-grid>.lead-personal-actions{grid-column:1/-1;grid-row:auto}.lead-full-page .lead-personal-demographics{grid-template-columns:repeat(3,minmax(0,1fr))}.lead-full-page .lead-income-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.lead-full-page{padding:14px 12px 24px}.lead-full-page .loan-application-card.lead-onboarding-card{padding:18px 18px 20px}.lead-full-page .lead-step-panel{padding:0}.lead-full-page .loan-stepper{gap:6px;margin-bottom:16px;padding-top:5px}.lead-full-page .loan-step{min-height:34px;padding:5px 9px}.lead-full-page .lead-step-panel>h2{font-size:16px}.lead-full-page .lead-personal-grid,.lead-full-page .lead-income-grid,.lead-full-page .lead-referral-grid,.lead-full-page .lead-address-row{grid-template-columns:1fr;gap:13px}.lead-full-page .lead-personal-grid>.lead-name-combo{display:grid;grid-column:1/-1;grid-row:auto;grid-template-columns:72px minmax(0,1fr);gap:10px}.lead-full-page .lead-personal-grid>.lead-field,.lead-full-page .lead-personal-grid>.lead-identity-field,.lead-full-page .lead-personal-grid>.lead-otp-field,.lead-full-page .lead-personal-grid>.lead-personal-actions{grid-column:1/-1;grid-row:auto}.lead-full-page .lead-personal-demographics{grid-template-columns:1fr}.lead-full-page .lead-personal-actions{justify-content:stretch}.lead-full-page .lead-personal-actions button{flex:1;min-width:0!important;padding:0 8px!important}.lead-full-page .lead-table-section{padding:12px}.lead-full-page .lead-table-heading{align-items:flex-start;flex-wrap:wrap}.lead-full-page .lead-income-content .lead-income-table{min-width:740px}.lead-full-page .lead-step-panel .lead-otp-field .lead-field input{width:100%}.lead-full-page .loan-form-actions .loan-back-button,.lead-full-page .loan-form-actions .loan-continue-button{min-width:90px}}
.lead-full-page{padding-left:48px;padding-right:48px}
.lead-full-page .loan-application-card.lead-onboarding-card{padding:22px 68px 26px}
.lead-full-page .lead-step-panel{padding:0 10px}
.lead-full-page .loan-stepper{margin-top:5px;padding-top:6px}
.lead-full-page .lead-personal-grid,.lead-full-page .lead-income-grid,.lead-full-page .lead-referral-grid,.lead-full-page .lead-address-row{row-gap:20px;column-gap:24px}
.lead-full-page .lead-personal-demographics{gap:20px}
.lead-full-page .lead-name-combo{column-gap:24px}
.lead-full-page .lead-step-panel>div[style*="grid-template-columns"]{gap:20px!important}
.lead-full-page .lead-address-row{padding:20px}
.lead-full-page .lead-step-panel input,.lead-full-page .lead-step-panel select,.lead-full-page .lead-personal-demographics .lead-calendar-picker .lead-date-picker-trigger,.lead-full-page .lead-data-table td input{border-color:rgba(0,0,0,.8)}
.lead-full-page .lead-step-panel input:focus,.lead-full-page .lead-step-panel select:focus,.lead-full-page .lead-personal-demographics .lead-calendar-picker .lead-date-picker-trigger:focus-visible{border-color:#08796f}
.lead-full-page .lead-step-panel input[name="age"]{width:76px;max-width:100%;background:#fff!important}
.lead-full-page .lead-personal-demographics .lead-field:last-child input{background:#fff!important}
.lead-full-page .lead-step-panel .lead-otp-field .lead-field input{width:160px;max-width:100%;background:#fff}
@media(max-width:900px){.lead-full-page .loan-application-card.lead-onboarding-card{padding:20px 52px 22px}.lead-full-page .lead-step-panel{padding:0 6px}}
@media(max-width:560px){.lead-full-page{padding-left:24px;padding-right:24px}.lead-full-page .loan-application-card.lead-onboarding-card{padding:18px 36px 20px}.lead-full-page .lead-step-panel{padding:0}.lead-full-page .lead-personal-grid,.lead-full-page .lead-income-grid,.lead-full-page .lead-referral-grid,.lead-full-page .lead-address-row{row-gap:16px;column-gap:14px}.lead-full-page .lead-personal-demographics{gap:16px}.lead-full-page .lead-personal-actions{grid-column:1/-1;grid-row:auto}.lead-full-page .lead-step-panel .lead-otp-field .lead-field input{width:100%}}
.lead-full-page{display:flex;width:100%;box-sizing:border-box;flex-direction:column;align-items:center;padding:24px clamp(24px,8vw,104px) 36px;background:#f2f7f6}
.los-page-wrap:has(.lead-full-page){max-width:none}
.lead-full-page>.loan-onboarding-heading,.lead-full-page .lead-page-content{width:100%;max-width:1200px;margin-left:auto;margin-right:auto}
.lead-full-page .lead-page-content,.lead-full-page .lead-form{width:100%}
.lead-full-page .loan-application-card.lead-onboarding-card{display:flex;width:100%;flex-direction:column;gap:14px;padding:0;border:0;background:transparent;box-shadow:none}
.lead-full-page .loan-stepper{display:flex;align-items:center;gap:0;overflow-x:auto;margin:0;padding:8px 14px;border:1px solid #e6eeec;border-radius:12px;background:#fff;box-shadow:0 3px 12px rgba(31,72,65,.04);scrollbar-width:thin}
.lead-full-page .loan-step{display:inline-flex;flex:1 0 auto;align-items:center;justify-content:center;gap:7px;min-width:0;min-height:36px;padding:5px 10px;border:0;border-radius:7px;background:transparent;color:#5a716c}
.lead-full-page .loan-step:disabled{opacity:.62}
.lead-full-page .loan-step.active{background:#e8f5f2;color:#08776e;box-shadow:none}
.lead-full-page .loan-step.done{background:#f3faf7;color:#267055}
.lead-full-page .loan-step-bubble{display:grid;place-items:center;flex:0 0 20px;width:20px;height:20px;border:1px solid #d5e5e0;border-radius:50%;background:#f1f7f5;color:#18877d}
.lead-full-page .loan-step-bubble svg{display:block;width:12px;height:12px}
.lead-full-page .loan-step-bubble::before{content:none}
.lead-full-page .loan-step.active .loan-step-bubble{border-color:#128b7f;background:#128b7f;color:#fff}
.lead-full-page .loan-step-text{font-size:11px;font-weight:600;white-space:nowrap}
.lead-full-page .lead-step-panel{min-width:0;padding:24px 18px;border:1px solid #e5eeeb;border-radius:14px;background:#f5f9f7;box-shadow:0 10px 28px rgba(31,72,65,.07)}
.lead-full-page .lead-step-panel>h2{margin:0 0 20px;padding:0 0 14px;border-bottom:1px solid #edf2f0;color:#173b39;font-size:18px;font-weight:700;line-height:1.35}
.lead-full-page .lead-field{gap:6px;color:#294642;font-size:11px;font-weight:600}
.lead-full-page .lead-step-panel input,.lead-full-page .lead-step-panel select,.lead-full-page .lead-personal-demographics .lead-calendar-picker .lead-date-picker-trigger{height:42px;min-height:42px;padding:0 12px;border:1px solid #899793;border-radius:7px;background:#f8faf9;color:#233c3a;font-size:12px;box-shadow:none}
.lead-full-page .lead-step-panel input:not([aria-invalid="true"]):not(:disabled),.lead-full-page .lead-step-panel select:not(:disabled),.lead-full-page .lead-step-panel textarea:not(:disabled),.lead-full-page .lead-step-panel .lead-calendar-picker .lead-date-picker-trigger:not([aria-invalid="true"]):not(:disabled){background-color:#fff!important}
.lead-full-page .lead-step-panel input:focus,.lead-full-page .lead-step-panel select:focus,.lead-full-page .lead-personal-demographics .lead-calendar-picker .lead-date-picker-trigger:focus-visible{border-color:#16877b;outline:none;box-shadow:0 0 0 3px rgba(22,135,123,.12)}
.lead-full-page .lead-step-panel input[readonly]:not([name="age"]):not([name="customerType"]),.lead-full-page .lead-computed-field:not([name="age"]):not([name="customerType"]){border-color:#899793;background:#fff!important;color:#667b76}
.lead-full-page .lead-step-panel input[aria-invalid=true]{border-color:#bd4848;background:#fffafa}
.lead-full-page .lead-personal-actions button,.lead-full-page .lead-verify-button,.lead-full-page .lead-otp-verify,.lead-full-page .lead-income-consent,.lead-full-page .lead-table-add{min-height:36px;border:1px solid #cfe4df;border-radius:7px;background:#eaf6f3;color:#14766c;font-size:11px;font-weight:650}
.lead-full-page .lead-personal-actions button:hover,.lead-full-page .lead-verify-button:hover,.lead-full-page .lead-otp-verify:hover,.lead-full-page .lead-income-consent:hover,.lead-full-page .lead-table-add:hover{background:#def0eb}
.lead-full-page .lead-address-content,.lead-full-page .lead-credit-content,.lead-full-page .lead-income-content{gap:16px}
.lead-full-page .lead-table-section{gap:14px;padding:16px;border:1px solid #e5eeeb;border-radius:10px;background:#fff;box-shadow:0 3px 12px rgba(31,72,65,.035)}
.lead-full-page .lead-table-heading h4{color:#244b46;font-size:13px;font-weight:700}
.lead-full-page .lead-address-rows{display:grid;gap:12px}
.lead-full-page .lead-address-row{gap:14px;padding:16px;border:1px solid #e5eeeb;border-radius:8px;background:#f8fbfa}
.lead-full-page .lead-data-table{border-color:#e2ebe8;border-radius:7px}
.lead-full-page .lead-data-table th,.lead-full-page .lead-data-table td{border-color:#e7eeec;color:#334f4a}
.lead-full-page .lead-data-table th{background:#f2f7f5}
.lead-full-page .lead-data-table td input{border-color:#899793;background:#f8faf9}
.lead-full-page .lead-data-table td button{border-color:#dce8e4;border-radius:6px;background:#f5f9f7;color:#315b53}
.lead-full-page .lead-income-actions{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.lead-full-page .lead-income-actions button{min-height:40px;border:1px solid #e0eae7;border-radius:7px;background:#f6faf8;color:#3e5b55;font-size:11px}
.lead-full-page .lead-referral-grid{gap:18px 20px}
.lead-full-page .lead-modal-footer{justify-content:center;gap:12px;margin-top:22px;padding-top:18px;border-top:1px solid #edf2f0}
.lead-full-page .loan-form-actions .loan-back-button,.lead-full-page .loan-form-actions .loan-continue-button{height:40px;min-width:144px;border-radius:7px;font-size:12px}
.lead-full-page .loan-form-actions .loan-continue-button{border-color:#128b7f;background:#128b7f;box-shadow:0 5px 12px rgba(18,139,127,.2)}
.lead-full-page .loan-form-actions .loan-back-button{border-color:#dce7e3;background:#fff;color:#47615c}
@media(max-width:760px){.lead-full-page{padding:18px 24px 28px}.lead-full-page .lead-step-panel{padding:20px}.lead-full-page .loan-stepper{justify-content:flex-start}.lead-full-page .loan-step{flex:0 0 auto;min-width:132px}.lead-full-page .lead-income-actions{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.lead-full-page{padding:14px 18px 24px}.lead-full-page .lead-step-panel{padding:18px 14px}.lead-full-page .lead-personal-grid,.lead-full-page .lead-income-grid,.lead-full-page .lead-referral-grid,.lead-full-page .lead-address-row{gap:14px}.lead-full-page .lead-step-panel>div[style*="grid-template-columns: repeat(2"]{grid-template-columns:1fr!important}.lead-full-page .lead-address-row{grid-template-columns:1fr;padding:12px}.lead-full-page .lead-income-actions{grid-template-columns:1fr}.lead-full-page .lead-table-section{padding:12px}.lead-full-page .lead-modal-footer{justify-content:stretch}.lead-full-page .loan-form-actions .loan-back-button,.lead-full-page .loan-form-actions .loan-continue-button{flex:1;min-width:0}}
.lead-full-page .lead-step-panel{--lead-icon-user:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23717d79' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='8' r='3'/%3E%3Cpath d='M5 20a7 7 0 0 1 14 0'/%3E%3C/svg%3E");--lead-icon-phone:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23717d79' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='7' y='2' width='10' height='20' rx='2'/%3E%3Cpath d='M11 18h2'/%3E%3C/svg%3E");--lead-icon-mail:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23717d79' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='5' width='18' height='14' rx='2'/%3E%3Cpath d='m3 7 9 6 9-6'/%3E%3C/svg%3E\");--lead-icon-home:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23717d79' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3 10 9-7 9 7'/%3E%3Cpath d='M5 9v12h14V9M9 21v-7h6v7'/%3E%3C/svg%3E");--lead-icon-card:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23717d79' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='5' width='18' height='14' rx='2'/%3E%3Ccircle cx='8' cy='11' r='2'/%3E%3Cpath d='M5 16c.8-2 5.2-2 6 0M14 10h4M14 14h4'/%3E%3C/svg%3E");--lead-icon-calendar:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23717d79' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='5' width='18' height='16' rx='2'/%3E%3Cpath d='M16 3v4M8 3v4M3 10h18'/%3E%3C/svg%3E");--lead-icon-tag:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23717d79' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 13 11 22l-9-9V2h11z'/%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3C/svg%3E");--lead-icon-money:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23717d79' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='6' width='18' height='14' rx='2'/%3E%3Cpath d='M7 6V4h10v2M12 10v6M14 11.5c0-.8-.8-1.5-2-1.5s-2 .7-2 1.5.8 1.5 2 1.5 2 .7 2 1.5-.8 1.5-2 1.5-2-.7-2-1.5'/%3E%3C/svg%3E");--lead-icon-work:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23717d79' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='7' width='18' height='14' rx='2'/%3E%3Cpath d='M8 7V4h8v3M3 12h18M10 12v2h4v-2'/%3E%3C/svg%3E");--lead-icon-lock:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23717d79' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='4' y='10' width='16' height='11' rx='2'/%3E%3Cpath d='M8 10V7a4 4 0 0 1 8 0v3M12 14v3'/%3E%3C/svg%3E");--lead-icon-document:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23717d79' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 3h9l4 4v14H6z'/%3E%3Cpath d='M14 3v5h5M9 13h7M9 17h7'/%3E%3C/svg%3E");--lead-icon-share:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23717d79' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='18' cy='5' r='3'/%3E%3Ccircle cx='6' cy='12' r='3'/%3E%3Ccircle cx='18' cy='19' r='3'/%3E%3Cpath d='m9 11 6-5M9 13l6 5'/%3E%3C/svg%3E")}
.lead-full-page .lead-step-panel input:not([type=hidden]),.lead-full-page .lead-step-panel select,.lead-full-page .lead-personal-demographics .lead-calendar-picker .lead-date-picker-trigger{padding-left:34px!important;background-repeat:no-repeat;background-position:11px center;background-size:14px 14px}
.lead-full-page .lead-step-panel input[name="namePrefix"],.lead-full-page .lead-step-panel input[name="firstName"],.lead-full-page .lead-step-panel input[name="middleName"],.lead-full-page .lead-step-panel input[name="lastName"],.lead-full-page .lead-step-panel input[name="occupation"],.lead-full-page .lead-step-panel input[name="partnerName"],.lead-full-page .lead-step-panel input[name="employeeName"],.lead-full-page .lead-step-panel input[aria-label*="type"],.lead-full-page .lead-step-panel input[aria-label*="city"],.lead-full-page .lead-step-panel input[aria-label*="landmark"]{background-image:var(--lead-icon-user)!important}
.lead-full-page .lead-step-panel input[name="mobileNumber"]{background-image:var(--lead-icon-phone)!important}
.lead-full-page .lead-step-panel input[name="email"],.lead-full-page .lead-step-panel input[name="empEmailId"]{background-image:var(--lead-icon-mail)!important}
.lead-full-page .lead-step-panel input[name="branch"],.lead-full-page .lead-step-panel input[name="flatBuildingName"],.lead-full-page .lead-step-panel input[name="streetRoad"],.lead-full-page .lead-step-panel input[name="employeeId"],.lead-full-page .lead-step-panel input[name="partnerId"],.lead-full-page .lead-step-panel input[aria-label*="building"],.lead-full-page .lead-step-panel input[aria-label*="street"],.lead-full-page .lead-step-panel input[aria-label*="state"]{background-image:var(--lead-icon-home)!important}
.lead-full-page .lead-step-panel input[name="panCard"],.lead-full-page .lead-step-panel input[name="aadhaarCard"],.lead-full-page .lead-step-panel input[name="passportNo"]{background-image:var(--lead-icon-card)!important}
.lead-full-page .lead-step-panel input[name="tenure"],.lead-full-page .lead-step-panel input[name="yearsOfService"]{background-image:var(--lead-icon-calendar)!important}
.lead-full-page .lead-step-panel input[name="otpNumber"],.lead-full-page .lead-step-panel input[name="panOtpNumber"]{background-image:none!important;padding-left:12px!important}
.lead-full-page .lead-step-panel input[name="loanProductType"],.lead-full-page .lead-step-panel input[name="employerType"],.lead-full-page .lead-step-panel input[name="employerName"],.lead-full-page .lead-step-panel input[name="designation"]{background-image:var(--lead-icon-work)!important}
.lead-full-page .lead-step-panel input[name="loanAmount"],.lead-full-page .lead-step-panel input[name="collateral"],.lead-full-page .lead-step-panel input[name="annualIncome"],.lead-full-page .lead-step-panel input[name="takeHomePay"],.lead-full-page .lead-step-panel input[name="monthlyEmi"],.lead-full-page .lead-step-panel input[name="totalInterest"],.lead-full-page .lead-step-panel input[name="securityAmount"],.lead-full-page .lead-step-panel input[name="incomeSource"]{background-image:var(--lead-icon-money)!important}
.lead-full-page .lead-step-panel input[name="instalments"],.lead-full-page .lead-step-panel input[name="interestRate"],.lead-full-page .lead-step-panel input[name="otherLoanPurpose"]{background-image:var(--lead-icon-document)!important}
.lead-full-page .lead-step-panel select[name="namePrefix"],.lead-full-page .lead-step-panel select[name="gender"],.lead-full-page .lead-step-panel select[name="maritalStatus"],.lead-full-page .lead-step-panel select[name="residentialStatus"],.lead-full-page .lead-step-panel select[aria-label*="type"]{background-image:var(--lead-icon-user)!important}
.lead-full-page .lead-step-panel select[name="loanPurpose"],.lead-full-page .lead-step-panel select[name="tenureUnit"]{background-image:var(--lead-icon-tag)!important}
.lead-full-page .lead-step-panel select[name="employmentType"]{background-image:var(--lead-icon-work)!important}
.lead-full-page .lead-step-panel select[name="acquisitionChannel"]{background-image:var(--lead-icon-share)!important}
.lead-full-page .lead-step-panel input[aria-label*="account"],.lead-full-page .lead-step-panel input[aria-label*="loan type"],.lead-full-page .lead-step-panel input[aria-label*="limit"],.lead-full-page .lead-step-panel input[aria-label*="EMI"],.lead-full-page .lead-step-panel input[aria-label*="outstanding"],.lead-full-page .lead-step-panel input[aria-label*="DPD"],.lead-full-page .lead-step-panel input[aria-label*="status"],.lead-full-page .lead-step-panel input[aria-label*="bank name"]{padding-left:27px!important;background-image:var(--lead-icon-document)!important;background-position:7px center;background-size:12px 12px}
.lead-full-page .lead-step-panel input[aria-label*="flat or building"],.lead-full-page .lead-step-panel input[aria-label*="street or road"]{background-image:var(--lead-icon-home)!important}
.lead-full-page .lead-step-panel select[aria-label*="type"]{background-image:var(--lead-icon-home)!important}
.lead-full-page .lead-step-panel input[aria-label*="PIN code"]{background-image:var(--lead-icon-card)!important}
.lead-full-page .lead-personal-demographics .lead-calendar-picker .lead-date-picker-trigger{background-image:none!important}
.lead-full-page .lead-step-panel input[name="age"]{background-image:none!important;padding-left:12px!important}
.lead-full-page .lead-step-panel .lead-otp-field .lead-field input{border-color:#899793;background-color:#fff!important}
.lead-full-page .lead-step-panel input[name="instalments"],.lead-full-page .lead-step-panel input[name="monthlyEmi"],.lead-full-page .lead-step-panel input[name="totalInterest"],.lead-full-page .lead-step-panel input[name="securityAmount"],.lead-full-page .lead-step-panel input[name="occupation"],.lead-full-page .lead-step-panel input[name="employerType"],.lead-full-page .lead-step-panel input[name="designation"]{background-image:none!important;padding-left:12px!important}
.lead-full-page .lead-step-panel select[name="acquisitionChannel"]{background-image:none!important;padding-left:12px!important}
.lead-full-page .lead-step-panel select[name="occupation"],.lead-full-page .lead-step-panel select[name="employerType"]{background-image:none!important;padding-left:12px!important}
.lead-full-page .lead-address-row .lead-address-street{grid-column:auto;width:100%}
.lead-full-page .lead-step-panel select[name="loanProductType"]{background-image:var(--lead-icon-work)!important}
.lead-full-page .lead-referral-grid{grid-template-columns:repeat(4,minmax(0,1fr));align-items:end;gap:18px 20px}
.lead-full-page .lead-referral-channel{grid-column:1;grid-row:1;min-width:0}
.lead-full-page .lead-referral-date{grid-column:2 / span 3;grid-row:1;min-width:0;max-width:280px}
.lead-full-page .lead-referral-partner-id{grid-column:1;grid-row:2;min-width:0}
.lead-full-page .lead-referral-partner-name{grid-column:2;grid-row:2;min-width:0}
.lead-full-page .lead-referral-employee-id{grid-column:3;grid-row:2;min-width:0}
.lead-full-page .lead-referral-employee-name{grid-column:4;grid-row:2;min-width:0}
.lead-full-page .lead-referral-grid .lead-field input,.lead-full-page .lead-referral-grid .lead-field select,.lead-full-page .lead-referral-date .lead-date-picker-trigger{background-color:#fff!important}
.lead-full-page .lead-referral-date .lead-calendar-picker,.lead-full-page .lead-referral-date .lead-date-picker-trigger{width:100%}
@media(max-width:760px){.lead-full-page .lead-referral-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.lead-full-page .lead-referral-channel,.lead-full-page .lead-referral-partner-id,.lead-full-page .lead-referral-partner-name,.lead-full-page .lead-referral-employee-id,.lead-full-page .lead-referral-employee-name{grid-column:span 1;grid-row:auto}.lead-full-page .lead-referral-date{grid-column:span 2;grid-row:auto}}
@media(max-width:560px){.lead-full-page .lead-referral-grid{grid-template-columns:1fr}.lead-full-page .lead-referral-channel,.lead-full-page .lead-referral-partner-id,.lead-full-page .lead-referral-partner-name,.lead-full-page .lead-referral-employee-id,.lead-full-page .lead-referral-employee-name,.lead-full-page .lead-referral-date{grid-column:1;grid-row:auto}}
.lead-full-page .lead-personal-name-row{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:16px;width:100%;max-width:960px}
.lead-full-page .lead-name-first-group{display:grid;grid-template-columns:52px minmax(0,1fr);align-items:end;gap:12px;min-width:0}
.lead-full-page .lead-personal-grid>.lead-personal-actions{grid-column:1/-1;grid-row:auto;justify-content:flex-start;width:100%;max-width:960px;margin-top:-10px}
.lead-full-page .lead-personal-actions button{min-height:34px!important;padding:0 12px!important;white-space:nowrap;font-size:10px}
.lead-full-page .lead-prefix-field select{padding-left:27px!important;padding-right:8px!important}
.lead-full-page .lead-personal-grid{box-sizing:border-box;width:100%;max-width:960px;margin:0 auto}
.lead-full-page .lead-personal-name-row,.lead-full-page .lead-personal-actions,.lead-full-page .lead-personal-demographics,.lead-full-page .lead-pan-identity-row,.lead-full-page .lead-personal-identity-row,.lead-full-page .lead-personal-contact-row,.lead-full-page .lead-personal-status-row,.lead-full-page .lead-personal-passport-row{max-width:960px}
.lead-full-page .lead-personal-demographics{grid-column:1/-1;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;width:100%}
.lead-full-page .lead-personal-contact-row,.lead-full-page .lead-personal-status-row,.lead-full-page .lead-personal-passport-row{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:16px;width:100%}
.lead-full-page .lead-personal-contact-row,.lead-full-page .lead-personal-status-row,.lead-full-page .lead-personal-passport-row{max-width:960px}
.lead-full-page .lead-personal-contact-row .lead-field,.lead-full-page .lead-personal-status-row .lead-field,.lead-full-page .lead-personal-passport-row .lead-field,.lead-full-page .lead-pan-identity-row > .lead-field,.lead-full-page .lead-personal-identity-row > .lead-field{max-width:320px}
.lead-full-page .lead-pan-identity-row,.lead-full-page .lead-personal-identity-row{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:16px;width:100%;max-width:960px}
.lead-full-page .lead-otp-combo{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:8px;min-width:0}
.lead-full-page .lead-identity-validation{grid-column:2;justify-self:start}
.lead-full-page .lead-otp-combo{grid-column:3}
.lead-full-page .lead-otp-combo .lead-field{min-width:0}
.lead-full-page .loan-birth-calendar .react-calendar__navigation{border:1px solid #d6e2de;background:#fff!important}
.lead-full-page .loan-birth-calendar .react-calendar__navigation button{background:#fff!important;color:#23474c!important}
.lead-full-page .loan-birth-calendar .react-calendar__navigation button:enabled:hover,.lead-full-page .loan-birth-calendar .react-calendar__navigation button:enabled:focus{background:#e5f3ef!important;color:#0c5d5d!important}
.lead-full-page .loan-birth-calendar .react-calendar__navigation button:disabled{color:#687873!important;opacity:1}
.lead-full-page .loan-birth-calendar .react-calendar__tile{color:#2c4751!important}
.lead-full-page .loan-birth-calendar .react-calendar__tile:enabled:hover,.lead-full-page .loan-birth-calendar .react-calendar__tile:enabled:focus{background:#e5f3ef!important;color:#0c5d5d!important}
.lead-full-page .loan-birth-calendar .react-calendar__tile--active,.lead-full-page .loan-birth-calendar .react-calendar__tile--active:enabled:hover,.lead-full-page .loan-birth-calendar .react-calendar__tile--active:enabled:focus{background:#177e7a!important;color:#fff!important}
.lead-full-page .loan-birth-calendar .react-calendar__tile:disabled{color:#687873!important}
@media(max-width:900px){.lead-full-page .lead-personal-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.lead-full-page .lead-personal-demographics{grid-column:1/-1;grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:760px){.lead-full-page .lead-otp-combo{grid-template-columns:minmax(0,1fr)}.lead-full-page .lead-otp-combo .lead-otp-verify{width:100%}}
@media(max-width:760px){.lead-full-page .lead-personal-name-row{grid-template-columns:repeat(3,minmax(0,1fr));max-width:none}.lead-full-page .lead-personal-grid>.lead-personal-actions{max-width:none;margin-top:-8px}}
@media(max-width:560px){.lead-full-page .lead-personal-grid{grid-template-columns:1fr}.lead-full-page .lead-personal-name-row{grid-template-columns:1fr;max-width:none}.lead-full-page .lead-name-first-group{grid-template-columns:52px minmax(0,1fr)}.lead-full-page .lead-personal-grid>.lead-personal-actions{max-width:none;margin-top:-8px;justify-content:stretch}.lead-full-page .lead-personal-demographics{grid-template-columns:1fr!important;gap:16px;width:100%}.lead-full-page .lead-personal-contact-row,.lead-full-page .lead-personal-status-row,.lead-full-page .lead-personal-passport-row,.lead-full-page .lead-personal-identity-row,.lead-full-page .lead-pan-identity-row{grid-template-columns:1fr!important}.lead-full-page .lead-identity-validation,.lead-full-page .lead-otp-combo{grid-column:1}}
.lead-full-page .lead-step-panel input[aria-label*="landmark"],.lead-full-page .lead-step-panel input[aria-label*="city"],.lead-full-page .lead-step-panel input[aria-label*="state"]{padding-left:34px!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23717d79' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z'/%3E%3Ccircle cx='12' cy='10' r='2.5'/%3E%3C/svg%3E")!important;background-position:11px center!important;background-size:14px 14px!important}
.lead-full-page .lead-step-panel input[name="partnerId"],.lead-full-page .lead-step-panel input[name="employeeId"]{padding-left:34px!important;background-image:var(--lead-icon-card)!important;background-position:11px center!important;background-size:14px 14px!important}
.lead-full-page .lead-step-panel input[name="interestRate"]{padding-left:34px!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23717d79' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m19 5-14 14'/%3E%3Ccircle cx='7.5' cy='7.5' r='2.5'/%3E%3Ccircle cx='16.5' cy='16.5' r='2.5'/%3E%3C/svg%3E")!important;background-position:11px center!important;background-size:14px 14px!important}
`;

export default function NewLead({ open, onClose, onCreate, onUpdate, initialData = null }) {
  const [form, setForm] = useState(initialForm);
  const [activeStep, setActiveStep] = useState(0);
  const [otpMessage, setOtpMessage] = useState('');
  const [panOtpMessage, setPanOtpMessage] = useState('');
  const [aadhaarMessage, setAadhaarMessage] = useState('');
  const [aadhaarValidated, setAadhaarValidated] = useState(false);
  const [panValidated, setPanValidated] = useState(false);
  const [panValidationMessage, setPanValidationMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [downPaymentMessage, setDownPaymentMessage] = useState('');
  const [creditFacilityErrors, setCreditFacilityErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [inputFeedback, setInputFeedback] = useState({});
  const [lookups, setLookups] = useState([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(false);
  const [lookupError, setLookupError] = useState('');

  useEffect(() => {
    if (!open) return undefined;

    setForm(getLeadFormValues(initialData));
    setActiveStep(0);
    setOtpMessage('');
    setPanOtpMessage('');
    setAadhaarMessage('');
    setAadhaarValidated(false);
    setPanValidated(false);
    setPanValidationMessage('');
    setSubmissionError('');
    setDownPaymentMessage('');
    setCreditFacilityErrors({});
    setTouchedFields({});
    setShowValidationErrors(false);
    setInputFeedback({});
    setIsSubmitting(false);
    return undefined;
  }, [open, initialData]);

  useEffect(() => {
    if (!open) return undefined;

    let isCurrent = true;
    setIsLoadingLookups(true);
    setLookupError('');
    getRetailLookups({ refresh: true })
      .then((result) => {
        if (isCurrent) setLookups(result);
      })
      .catch((error) => {
        if (isCurrent) {
          setLookupError(error instanceof Error ? error.message : 'Unable to load lookup values.');
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoadingLookups(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [open]);

  if (!open) return null;

  const computedAge = form.dateOfBirth ? getAgeFromDob(form.dateOfBirth) : '';
  const computedCustomerType = form.dateOfBirth ? getCustomerTypeFromAge(computedAge) : '';
  const tenureMonths = Number(form.tenure) * ({ month: 1, quarter: 3, year: 12 }[normalizeLookupValue(form.tenureUnit)] || 1);
  const employmentType = normalizeLookupValue(form.employmentType);
  const isSelfEmployed = employmentType.includes('selfemployed');
  const isSalariedOrEmployee = employmentType.includes('salaried') || employmentType.includes('employee');
  const isOtherLoanPurpose = normalizeLookupValue(form.loanPurpose) === 'other';
  const computedInstalments = Number.isFinite(tenureMonths) && tenureMonths > 0 ? String(tenureMonths) : '';
  const principal = Number(form.loanAmount) - Number(form.collateral || 0);
  const annualInterestRate = form.interestRate === '' ? null : Number(form.interestRate);
  const monthlyRate = Number.isFinite(annualInterestRate) && annualInterestRate >= 0 ? annualInterestRate / 1200 : null;
  const calculatedEmi = principal > 0 && tenureMonths > 0 && monthlyRate !== null
    ? monthlyRate === 0
      ? principal / tenureMonths
      : (principal * monthlyRate) / (1 - ((1 + monthlyRate) ** -tenureMonths))
    : null;
  const computedMonthlyEmi = Number.isFinite(calculatedEmi) ? String(Math.round(calculatedEmi)) : '';
  const calculatedTotalInterest = calculatedEmi === null ? null : Math.max(0, (calculatedEmi * tenureMonths) - principal);
  const computedTotalInterest = Number.isFinite(calculatedTotalInterest) ? String(Math.round(calculatedTotalInterest)) : '';
  const computedTotalAmount = principal > 0 && computedTotalInterest !== ''
    ? String(Math.round(principal + Number(computedTotalInterest)))
    : '';
  const todayInputDate = getTodayInputDate();
  const getLookupType = (field) => {
    const names = lookupNamesByField[field] || [];
    return lookups.find((lookup) => names.some((name) => normalizeLookupValue(lookup.name) === normalizeLookupValue(name)));
  };
  const getLookupValues = (field, currentValue, normalize = false) => {
    const lookup = getLookupType(field);
    const options = (lookup?.subLookups || [])
      .slice()
      .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
      .map((option, index) => ({
        id: option.id ?? option.code ?? `${lookup.code}-${index}`,
        code: option.code ?? '',
        name: option.name ?? option.description ?? option.code ?? '',
      }))
      .filter((option) => option.name);
    const matchesCurrentValue = (option) => normalize
      ? normalizeLookupValue(option.name) === normalizeLookupValue(currentValue)
      : option.name === currentValue;
    if (!currentValue || options.some(matchesCurrentValue)) return options;
    return [{ id: `current-${field}-${currentValue}`, name: currentValue }, ...options];
  };
  const getSelectPlaceholder = (field) => {
    const lookup = getLookupType(field);
    const labels = {
      namePrefix: 'Title',
      residentialStatus: 'Residential Status',
      gender: 'Gender',
      maritalStatus: 'Marital Status',
      addressType: 'Address Type',
      loanProductType: 'Loan Product Type',
      loanPurpose: 'Loan Purpose',
      tenureUnit: 'Tenure Unit',
      occupation: 'Occupation',
      employerType: 'Employer Type',
      employmentType: 'Employment Type',
      acquisitionChannel: 'Acquisition Channel',
    };
    return (
      <option value="" data-lookup-code={lookup?.code}>
        {`Select ${lookup?.code || lookup?.name || labels[field] || ''}`.trim()}
      </option>
    );
  };
  const aadhaarInputInvalid = Boolean(aadhaarMessage && /required|remaining|invalid|enter a valid/i.test(aadhaarMessage));
  const downPaymentExceedsLoan = form.loanAmount !== ''
    && Number(form.loanAmount) > 0
    && form.collateral !== ''
    && Number(form.collateral) >= Number(form.loanAmount);
  const downPaymentError = downPaymentMessage || (downPaymentExceedsLoan ? 'Down payment below the loan amount.' : '');

  const getFieldValidationMessage = (name, value) => {
    const text = String(value ?? '');
    if (name === 'branch' && !text.trim()) return 'Branch is required.';
    if (name === 'dateOfBirth' && !text) return 'Date of Birth is required.';
    if (['firstName', 'middleName', 'lastName', 'designation'].includes(name)) {
      if (!text.trim()) return ['firstName', 'lastName'].includes(name) ? 'This field is required.' : '';
      const letterCount = Array.from(text).filter((character) => /\p{L}/u.test(character)).length;
      if (letterCount < 3 || text.length > 50 || !nameHasValidCharacters(text)) {
        return 'Use 3-50 alphabetic characters; single spaces between words are allowed.';
      }
    }
    if (name === 'mobileNumber' && !/^[6-9]\d{9}$/.test(text)) {
      return 'Enter a 10-digit mobile number starting with 6, 7, 8, or 9.';
    }
    if (['email', 'empEmailId'].includes(name) && text && !new RegExp(`^(?:${EMAIL_PATTERN})$`).test(text)) {
      return 'Enter a valid email address with a complete domain.';
    }
    if (name === 'loanAmount' && text && (!/^\d{1,12}$/.test(text) || Number(text) <= 0)) {
      return 'Enter a positive loan amount of up to 12 digits.';
    }
    if (name === 'interestRate' && text
      && (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text) || Number(text) < 0 || Number(text) > 100)) {
      return 'Enter an interest rate from 0 to 100 with up to 2 decimal places.';
    }
    if (name === 'otherLoanPurpose' && isOtherLoanPurpose && !text.trim()) {
      return 'Enter the specific purpose of the loan.';
    }
    if (name === 'yearsOfService' && text && (!/^\d+(?:\.\d)?$/.test(text) || Number(text) < 0)) {
      return 'Enter a valid non-negative number of years.';
    }
    if (name === 'annualIncome' && text && (!/^\d+(?:\.\d{1,2})?$/.test(text) || Number(text) <= 0)) {
      return 'Enter a positive gross income.';
    }
    if (name === 'takeHomePay' && text && (!/^\d+(?:\.\d{1,2})?$/.test(text) || Number(text) < 0)) {
      return 'Enter a valid non-negative net income.';
    }
    if (['occupation', 'employerType', 'employerName'].includes(name) && text
      && (text.length < 3 || text.length > 100 || !nameHasValidCharacters(text))) {
      return 'Use 3-100 alphabetic characters; single spaces between words are allowed.';
    }
    return '';
  };
  const shouldShowFieldError = (name) => showValidationErrors || Boolean(touchedFields[name]);
  const getVisibleFieldError = (name, value) => (
    shouldShowFieldError(name) ? getFieldValidationMessage(name, value) : ''
  );
  const getVisibleAddressError = (index, field, value, label) => (
    shouldShowFieldError(`addressDetails.${index}.${field}`)
      ? getAddressFieldError(field, value, label)
      : ''
  );
  const updateAddressField = (index, field, value) => {
    let normalizedValue;
    if (field === 'pinCode') {
      normalizedValue = value.replace(/\D/g, '').slice(0, 6);
    } else {
      const allowedPattern = ['city', 'state', 'addressType'].includes(field)
        ? /[^\p{L}\p{M} .'-]/gu
        : /[^\p{L}\p{M}0-9 .,'#/-]/gu;
      const maxLength = field === 'streetRoad' ? 150 : 100;
      normalizedValue = value.replace(allowedPattern, '').replace(/ {2,}/g, ' ').replace(/^ +/, '').slice(0, maxLength);
    }

    const feedbackKey = `addressDetails.${index}.${field}`;
    setInputFeedback((current) => ({
      ...current,
      [feedbackKey]: normalizedValue !== value ? 'Remove unsupported characters from this field.' : '',
    }));
    updateRow('addressDetails', index, field, normalizedValue);
  };

  const updateRow = (collection, index, field, value) => {
    setForm((current) => ({
      ...current,
      [collection]: current[collection].map((row, rowIndex) => (
        rowIndex === index ? { ...row, [field]: value } : row
      )),
    }));
    setTouchedFields((current) => ({ ...current, [`${collection}.${index}.${field}`]: true }));
    if (creditFacilityFields[collection]) {
      setCreditFacilityErrors((current) => ({ ...current, [collection]: '' }));
    }
  };
    const removeRow = (collection, index) => {
    setForm((current) => ({
      ...current,
      [collection]: current[collection].filter((_, rowIndex) => rowIndex !== index),
    }));
    if (creditFacilityFields[collection]) {
      setCreditFacilityErrors((current) => ({ ...current, [collection]: '' }));
    }
  };
  const addCreditFacility = (collection) => {
    const facilities = form[collection];
    const invalidIndex = facilities.findIndex((facility) => getCreditFacilityError(collection, facility));
    if (invalidIndex >= 0) {
      setCreditFacilityErrors((current) => ({
        ...current,
        [collection]: `Facility ${invalidIndex + 1}: ${getCreditFacilityError(collection, facilities[invalidIndex])}`,
      }));
      return;
    }

    setCreditFacilityErrors((current) => ({ ...current, [collection]: '' }));
    setForm((current) => ({
      ...current,
      [collection]: [...current[collection], createCreditFacilityRow()],
    }));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nameFields = ['firstName', 'middleName', 'lastName', 'designation', 'occupation', 'employerType', 'employerName'];
    const sanitizedText = nameFields.includes(name)
      ? value.replace(/[^\p{L}\p{M} ]/gu, '').replace(/ {2,}/g, ' ').replace(/^ +/, '').slice(0, 100)
      : value;
    const normalizedValue = name === 'aadhaarCard' || name === 'otpNumber' || name === 'panOtpNumber'
      ? value.replace(/\D/g, '').slice(0, name === 'aadhaarCard' ? 12 : 6)
      : name === 'mobileNumber' ? value.replace(/\D/g, '').replace(/^[0-5]+/, '').slice(0, 10)
      : ['firstName', 'middleName', 'lastName', 'designation'].includes(name) ? sanitizedText.slice(0, 50)
      : ['occupation', 'employerType', 'employerName'].includes(name) ? sanitizedText
      : name === 'loanAmount' ? value.includes('-') ? '' : value.replace(/\D/g, '').slice(0, 12)
      : ['interestRate', 'yearsOfService', 'annualIncome', 'takeHomePay'].includes(name) ? (() => {
        if (value.includes('-')) return '';
        const numeric = value.replace(/[^\d.]/g, '');
        const [whole, ...fraction] = numeric.split('.');
        const decimalPlaces = name === 'yearsOfService' ? 1 : 2;
        return `${whole}${fraction.length ? `.${fraction.join('').slice(0, decimalPlaces)}` : ''}`;
      })()
      : name === 'panCard' ? normalizePan(value)
      : name === 'passportNo' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) : value;

    if (name === 'collateral') {
      if (value !== '' && form.loanAmount !== '' && Number(form.loanAmount) > 0 && Number(value) >= Number(form.loanAmount)) {
        setDownPaymentMessage('Down payment below the loan amount.');
        return;
      }
      setDownPaymentMessage('');
    }

    if (name === 'loanAmount') {
      const downPayment = Number(form.collateral);
      setDownPaymentMessage(value !== ''
        && Number(value) > 0
        && form.collateral !== ''
        && downPayment >= Number(value)
        ? 'Down payment below the loan amount.'
        : '');
    }

    setForm((current) => ({
      ...current,
      [name]: normalizedValue,
      ...(name === 'emiBounce' && normalizedValue !== 'Yes' ? { noOfBounce: '' } : {}),
      ...(name === 'acquisitionChannel' && !['bankgenerated', 'branch'].includes(normalizeLookupValue(normalizedValue))
        ? { referralDate: '', partnerId: '', partnerName: '', employeeId: '', employeeName: '' }
        : {}),
      ...(name === 'employmentType' && normalizeLookupValue(value).includes('selfemployed') ? { designation: '' } : {}),
      ...(name === 'loanPurpose' && normalizeLookupValue(normalizedValue) !== 'other' ? { otherLoanPurpose: '' } : {}),
      ...(name === 'namePrefix' && titleGender(normalizedValue) ? { gender: titleGender(normalizedValue) } : {}),
      ...(name === 'gender' && titleGender(form.namePrefix) && titleGender(form.namePrefix) !== normalizedValue
        ? { namePrefix: normalizedValue === 'Male' ? 'Mr.' : normalizedValue === 'Female' ? 'Ms.' : 'Other' }
        : {}),
      ...(name === 'aadhaarCard' ? { otpSent: false, otpNumber: '' } : {}),
      ...(name === 'panCard' ? { panOtpNumber: '' } : {}),
    }));
    setTouchedFields((current) => ({ ...current, [name]: true }));
    setInputFeedback((current) => ({
      ...current,
      [name]: nameFields.includes(name) && sanitizedText !== value
        ? 'Use alphabetic characters and spaces only.'
        : '',
    }));
    if (typeof event.target.setCustomValidity === 'function') {
      event.target.setCustomValidity(getFieldValidationMessage(name, normalizedValue));
    }
    if (name === 'aadhaarCard') {
      setAadhaarValidated(false);
      setOtpMessage('');
      setAadhaarMessage(!normalizedValue
        ? 'Aadhaar number is required.'
        : normalizedValue.length < 12
          ? `Enter all 12 digits. ${12 - normalizedValue.length} remaining.`
          : '12-digit Aadhaar number format is valid.');
    }
    if (name === 'panCard') {
      setPanValidated(false);
      setPanValidationMessage('');
      setPanOtpMessage('');
    }
    setSubmissionError('');
  };

  const resetAndClose = (force = false) => {
    if (isSubmitting && !force) return;
    setForm(initialForm);
    setActiveStep(0);
    setOtpMessage('');
    setPanOtpMessage('');
    setAadhaarMessage('');
    setAadhaarValidated(false);
    setPanValidated(false);
    setPanValidationMessage('');
    setSubmissionError('');
    setDownPaymentMessage('');
    setIsSubmitting(false);
    onClose();
  };

  const validateStep = () => {
    setShowValidationErrors(true);
    const activePanel = document.querySelector('.lead-full-page .lead-step-panel');
    if (!activePanel) {
      setSubmissionError('Unable to validate this step. Please try again.');
      return false;
    }

    if (activeStep === 1) {
      if (!form.addressDetails.length) return false;
      const invalidAddressIndex = form.addressDetails.findIndex((address) => getAddressError(address));
      if (invalidAddressIndex >= 0) {
        const invalidAddress = form.addressDetails[invalidAddressIndex];
        focusInvalidAddressField(invalidAddressIndex, invalidAddress);
        return false;
      }
    }

    if (activeStep === 2) {
      const collateralField = activePanel.querySelector('input[name="collateral"]');
      const amount = Number(form.loanAmount);
      const downPayment = Number(form.collateral || 0);
      const invalidDownPayment = amount > 0 && downPayment >= amount;

      if (invalidDownPayment) {
        setDownPaymentMessage('Down payment below the loan amount.');
        collateralField?.focus();
        return false;
      }
    }

    if (activeStep === 0) {
      const aadhaarField = activePanel.querySelector('input[name="aadhaarCard"]');
      const aadhaar = form.aadhaarCard;
      /* Previous hardcoded checksum validation:
      const invalidAadhaar = !/^[0-9]{12}$/.test(aadhaar) || !hasValidAadhaarChecksum(aadhaar);
      */
      const invalidAadhaar = !isBasicAadhaarNumber(aadhaar);
      aadhaarField?.setCustomValidity(invalidAadhaar ? 'Enter a valid 12-digit Aadhaar number.' : '');
      if (invalidAadhaar) {
        setAadhaarMessage(!aadhaar ? 'Aadhaar number is required.' : 'Enter a valid 12-digit Aadhaar number.');
      }
    }

    const fields = Array.from(activePanel.querySelectorAll('input:not([type="hidden"]), select'));
    fields.forEach((field) => {
      if (field.name !== 'aadhaarCard') {
        field.setCustomValidity(getFieldValidationMessage(field.name, field.value));
      }
    });
    const invalidField = fields.find((field) => field.willValidate && !field.checkValidity());

    if (invalidField) {
      invalidField.focus();
      invalidField.reportValidity();
      return false;
    }

    if (activeStep === 0 && !form.dateOfBirth) {
      activePanel.querySelector('[data-date-picker-trigger="dateOfBirth"]')?.focus();
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setShowValidationErrors(false);
      setTouchedFields({});
      setActiveStep((current) => current + 1);
    }
  };

  const handleValidateAadhaar = () => {
    /* Previous hardcoded checksum validation:
    if (!/^[0-9]{12}$/.test(form.aadhaarCard) || !hasValidAadhaarChecksum(form.aadhaarCard)) {
      setAadhaarValidated(false);
      setAadhaarMessage('Enter a valid 12-digit Aadhaar number.');
      setOtpMessage('Enter and validate a valid 12-digit Aadhaar number first.');
      return;
    }
    */
    if (!isBasicAadhaarNumber(form.aadhaarCard)) {
      setAadhaarValidated(false);
      setAadhaarMessage('Enter a valid 12-digit Aadhaar number.');
      setOtpMessage('Enter and validate a valid 12-digit Aadhaar number first.');
      return;
    }

    setAadhaarValidated(true);
    setAadhaarMessage('Aadhaar number format is valid.');
    setOtpMessage('');
  };

  const handleVerifyOtp = () => {
    if (!aadhaarValidated) {
      setOtpMessage('Validate the Aadhaar number before entering the OTP.');
      return;
    }

    if (!/^[0-9]{6}$/.test(form.otpNumber)) {
      setOtpMessage('Enter the 6-digit OTP to check its format.');
      return;
    }

    setOtpMessage('OTP format is valid.');
  };

  const handleValidatePan = () => {
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.panCard)) {
      setPanValidated(false);
      setPanValidationMessage('Enter PAN in the format ABCDE1234F.');
      return;
    }

    setPanValidated(true);
    setPanValidationMessage('PAN number format is valid.');
  };

  const handleVerifyPanOtp = () => {
    if (!panValidated) {
      setPanOtpMessage('Validate the PAN number before entering the OTP.');
      return;
    }

    if (!/^[0-9]{6}$/.test(form.panOtpNumber)) {
      setPanOtpMessage('Enter the 6-digit OTP to check its format.');
      return;
    }

    setPanOtpMessage('OTP format is valid.');
  };

  const formatCurrency = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

  const renderPersonalDetails = () => (
    <div className="lead-personal-grid">
      <div className="lead-personal-name-row">
        <div className="lead-name-first-group">
          <label className="lead-field lead-prefix-field">
            <span>Title <em>*</em></span>
            <select name="namePrefix" value={form.namePrefix} onChange={handleChange} required>
              {getSelectPlaceholder('namePrefix')}
              {getLookupValues('namePrefix', form.namePrefix).map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
            </select>
          </label>
          <label className="lead-field">
            <span>First Name <em>*</em></span>
            <input name="firstName" value={form.firstName} onChange={handleChange} onBlur={() => setTouchedFields((current) => ({ ...current, firstName: true }))} required minLength={3} maxLength={50} autoComplete="given-name" title="Use 3-50 alphabetic characters; single spaces between words are allowed." aria-invalid={Boolean(getVisibleFieldError('firstName', form.firstName))} style={{ backgroundColor: '#f5faf8' }} />
            {getVisibleFieldError('firstName', form.firstName) ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleFieldError('firstName', form.firstName)}</p> : null}
          </label>
        </div>
        <label className="lead-field">
          <span>Middle Name</span>
          <input name="middleName" value={form.middleName} onChange={handleChange} minLength={3} maxLength={50} autoComplete="additional-name" title="Use 3-50 alphabetic characters; single spaces between words are allowed." aria-invalid={Boolean(getVisibleFieldError('middleName', form.middleName))} style={{ backgroundColor: '#f5faf8' }} />
          {getVisibleFieldError('middleName', form.middleName) ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleFieldError('middleName', form.middleName)}</p> : null}
        </label>
        <label className="lead-field">
          <span>Last Name <em>*</em></span>
          <input name="lastName" value={form.lastName} onChange={handleChange} onBlur={() => setTouchedFields((current) => ({ ...current, lastName: true }))} required minLength={3} maxLength={50} autoComplete="family-name" title="Use 3-50 alphabetic characters; single spaces between words are allowed." aria-invalid={Boolean(getVisibleFieldError('lastName', form.lastName))} style={{ backgroundColor: '#f5faf8' }} />
          {getVisibleFieldError('lastName', form.lastName) ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleFieldError('lastName', form.lastName)}</p> : null}
        </label>
      </div>
      <div className="lead-personal-actions">
        <button type="button" style={{ minWidth: '168px', minHeight: '42px', border: '1px solid #bfd4e8', background: '#edf3fb', color: '#20476d', borderRadius: '6px', fontWeight: 600, padding: '0 16px' }}>
          De-Duplicate Check
        </button>
        <button type="button" style={{ minWidth: '150px', minHeight: '42px', border: '1px solid #bfd4e8', background: '#edf3fb', color: '#20476d', borderRadius: '6px', fontWeight: 600, padding: '0 16px' }}>
          Blacklist Check
        </button>
      </div>

      <div className="lead-personal-demographics" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px', width: '100%', maxWidth: '960px' }}>
        <label className="lead-field" onClick={() => setTouchedFields((current) => ({ ...current, dateOfBirth: true }))}>
          <span>Date of Birth <em>*</em></span>
          <LeadDatePicker
            id="lead-date-of-birth"
            name="dateOfBirth"
            label="Date of Birth"
            value={form.dateOfBirth}
            onChange={(value) => {
              handleChange({ target: { name: 'dateOfBirth', value } });
              setSubmissionError('');
            }}
            max={todayInputDate}
            required
            triggerStyle={{ backgroundColor: '#fff', backgroundImage: 'none', borderColor: '#899793', color: '#233c3a', width: '100%', maxWidth: '100%' }}
          />
          {getVisibleFieldError('dateOfBirth', form.dateOfBirth) ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleFieldError('dateOfBirth', form.dateOfBirth)}</p> : null}
        </label>
        <label className="lead-field">
          <span>Age</span>
          <input name="age" value={computedAge} readOnly className="lead-computed-field" style={{ width: '125px', maxWidth: '100%', borderColor: '#899793', background: '#fff', color: '#233c3a', backgroundImage: 'none', paddingLeft: '12px' }} />
        </label>
        <label className="lead-field">
          <span>Customer Type</span>
          <input name="customerType" value={computedCustomerType} readOnly className="lead-computed-field" style={{ borderColor: '#899793', background: '#fff', color: '#233c3a', backgroundImage: 'none', paddingLeft: '12px' }} />
        </label>
      </div>

      <div className="lead-pan-identity-row">
        <label className="lead-field">
          <span>PAN Card <em>*</em></span>
          <input name="panCard" value={form.panCard} onChange={handleChange} autoComplete="off" maxLength={10} pattern="[A-Z]{5}[0-9]{4}[A-Z]" required title="Enter PAN in the format ABCDE1234F." aria-invalid={Boolean(panValidationMessage && !panValidated)} />
        </label>
        <button type="button" onClick={handleValidatePan} className="lead-verify-button lead-identity-validation" style={{ whiteSpace: 'nowrap' }}>Validate PAN</button>
        <div className="lead-otp-combo">
          <label className="lead-field">
            <span>OTP Number</span>
            <input name="panOtpNumber" value={form.panOtpNumber} onChange={handleChange} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} title="Enter the 6-digit PAN OTP." disabled={!panValidated} />
          </label>
          <button type="button" className="lead-otp-verify" onClick={handleVerifyPanOtp} disabled={!panValidated} style={{ whiteSpace: 'nowrap' }}>Verify OTP</button>
        </div>
        {panValidationMessage ? <p className={`lead-inline-hint${panValidated ? '' : ' lead-inline-hint-error'}`} role="status" style={{ gridColumn: '1 / -1' }}>{panValidationMessage}</p> : null}
        {panOtpMessage ? <p className="lead-otp-message" role="status" style={{ gridColumn: '1 / -1' }}>{panOtpMessage}</p> : null}
      </div>

      <div className="lead-personal-identity-row">
        <label className="lead-field">
          <span>Aadhaar Number <em>*</em></span>
          <input name="aadhaarCard" value={form.aadhaarCard} onChange={handleChange} inputMode="numeric" autoComplete="off" pattern="[0-9]{12}" maxLength={12} required aria-invalid={aadhaarInputInvalid} aria-describedby="lead-aadhaar-hint" title="Enter a valid 12-digit Aadhaar number without spaces." />
        </label>
        <button type="button" onClick={handleValidateAadhaar} className="lead-verify-button lead-identity-validation" style={{ whiteSpace: 'nowrap' }}>Validate Aadhaar</button>
        <div className="lead-otp-combo">
          <label className="lead-field">
            <span>OTP Number</span>
            <input name="otpNumber" value={form.otpNumber} onChange={handleChange} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} title="Enter the 6-digit OTP." disabled={!aadhaarValidated} />
          </label>
          <button type="button" className="lead-otp-verify" onClick={handleVerifyOtp} disabled={!aadhaarValidated} style={{ whiteSpace: 'nowrap' }}>Verify OTP</button>
        </div>
        <p id="lead-aadhaar-hint" role="status" className={`lead-inline-hint${aadhaarInputInvalid ? ' lead-inline-hint-error' : ''}`} style={{ gridColumn: '1 / -1' }}>{aadhaarMessage || 'Enter the 12-digit Aadhaar number.'}</p>
        {otpMessage ? <p className="lead-otp-message" role="status" style={{ gridColumn: '1 / -1' }}>{otpMessage}</p> : null}
      </div>

      <div className="lead-personal-contact-row">
        <label className="lead-field">
          <span>Mobile Number <em>*</em></span>
          <input name="mobileNumber" type="tel" value={form.mobileNumber} onChange={handleChange} inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} required title="Enter a 10-digit mobile number starting with 6, 7, 8, or 9." aria-invalid={Boolean(getVisibleFieldError('mobileNumber', form.mobileNumber))} />
          {getVisibleFieldError('mobileNumber', form.mobileNumber) ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleFieldError('mobileNumber', form.mobileNumber)}</p> : null}
        </label>
        <label className="lead-field">
          <span>Email ID</span>
          <input name="email" type="email" value={form.email} onChange={handleChange} maxLength={254} pattern={EMAIL_PATTERN} autoComplete="email" title="Enter a valid email address with a complete domain." aria-invalid={Boolean(form.email && getFieldValidationMessage('email', form.email))} />
          {form.email && getFieldValidationMessage('email', form.email) ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getFieldValidationMessage('email', form.email)}</p> : null}
        </label>
        <label className="lead-field">
          <span>Branch <em>*</em></span>
          <input name="branch" value={form.branch} onChange={handleChange} required aria-invalid={Boolean(getVisibleFieldError('branch', form.branch))} />
          {getVisibleFieldError('branch', form.branch) ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleFieldError('branch', form.branch)}</p> : null}
        </label>
      </div>

      <div className="lead-personal-status-row">
        <label className="lead-field">
          <span>Residential Status</span>
          <select name="residentialStatus" value={form.residentialStatus} onChange={handleChange}>
            {getSelectPlaceholder('residentialStatus')}
            {getLookupValues('residentialStatus', form.residentialStatus).map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
          </select>
        </label>

        <label className="lead-field">
          <span>Gender <em>*</em></span>
          <select name="gender" value={form.gender} onChange={handleChange} required>
            {getSelectPlaceholder('gender')}
            {getLookupValues('gender', form.gender).map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
          </select>
        </label>

        <label className="lead-field">
          <span>Marital Status <em>*</em></span>
          <select name="maritalStatus" value={form.maritalStatus} onChange={handleChange} required>
            {getSelectPlaceholder('maritalStatus')}
            {getLookupValues('maritalStatus', form.maritalStatus).map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
          </select>
        </label>
      </div>

      <div className="lead-personal-passport-row">
        <label className="lead-field">
          <span>Passport No.</span>
          <input name="passportNo" value={form.passportNo} onChange={handleChange} pattern="[A-Z][0-9]{7}" maxLength={8} title="Enter an Indian passport number in the format A1234567." />
        </label>

        <label className="lead-field">
          <span>Passport Expiry Date</span>
          <LeadDatePicker
            id="lead-passport-expiry-date"
            name="passportExpiryDate"
            label="Passport Expiry Date"
            value={form.passportExpiryDate}
            onChange={(value) => handleChange({ target: { name: 'passportExpiryDate', value } })}
            min={todayInputDate}
          />
        </label>

        <label className="lead-field">
          <span>Income Source</span>
          <input name="incomeSource" value={form.incomeSource} onChange={handleChange} />
        </label>
      </div>

    </div>
  );

 

  const renderAddressDetails = () => (
    <div className="lead-address-content">
      <div className="lead-table-section">
        <div className="lead-table-heading">
          <h4>Address Details</h4>
        </div>
        {showValidationErrors && !form.addressDetails.length ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">Add at least one complete address before continuing.</p> : null}
        <div className="lead-address-rows">
          {form.addressDetails.map((address, index) => (
            <div className="lead-address-row" key={index}>
              <label className="lead-field">
                <span>Address Type <em>*</em></span>
                <select aria-label={`Address ${index + 1} type`} value={address.addressType} onChange={(event) => updateAddressField(index, 'addressType', event.target.value)} onBlur={() => setTouchedFields((current) => ({ ...current, [`addressDetails.${index}.addressType`]: true }))} required aria-invalid={Boolean(getVisibleAddressError(index, 'addressType', address.addressType, 'Address Type'))}>
                  {getSelectPlaceholder('addressType')}
                  {getLookupValues('addressType', address.addressType).map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
                </select>
                {getVisibleAddressError(index, 'addressType', address.addressType, 'Address Type') || inputFeedback[`addressDetails.${index}.addressType`] ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleAddressError(index, 'addressType', address.addressType, 'Address Type') || inputFeedback[`addressDetails.${index}.addressType`]}</p> : null}
              </label>
              <label className="lead-field lead-address-street">
                <span>Street / Road <em>*</em></span>
                <input aria-label={`Address ${index + 1} street or road`} value={address.streetRoad} onChange={(event) => updateAddressField(index, 'streetRoad', event.target.value)} onBlur={() => setTouchedFields((current) => ({ ...current, [`addressDetails.${index}.streetRoad`]: true }))} maxLength={150} required aria-invalid={Boolean(getVisibleAddressError(index, 'streetRoad', address.streetRoad, 'Street / Road'))} />
                {getVisibleAddressError(index, 'streetRoad', address.streetRoad, 'Street / Road') || inputFeedback[`addressDetails.${index}.streetRoad`] ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleAddressError(index, 'streetRoad', address.streetRoad, 'Street / Road') || inputFeedback[`addressDetails.${index}.streetRoad`]}</p> : null}
              </label>
              <label className="lead-field">
                <span>Flat / Building <em>*</em></span>
                <input aria-label={`Address ${index + 1} flat or building`} value={address.flatBuildingName} onChange={(event) => updateAddressField(index, 'flatBuildingName', event.target.value)} onBlur={() => setTouchedFields((current) => ({ ...current, [`addressDetails.${index}.flatBuildingName`]: true }))} maxLength={100} required aria-invalid={Boolean(getVisibleAddressError(index, 'flatBuildingName', address.flatBuildingName, 'Flat / Building'))} />
                {getVisibleAddressError(index, 'flatBuildingName', address.flatBuildingName, 'Flat / Building') || inputFeedback[`addressDetails.${index}.flatBuildingName`] ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleAddressError(index, 'flatBuildingName', address.flatBuildingName, 'Flat / Building') || inputFeedback[`addressDetails.${index}.flatBuildingName`]}</p> : null}
              </label>
              <label className="lead-field">
                <span>Landmark <em>*</em></span>
                <input aria-label={`Address ${index + 1} landmark`} value={address.landmark} onChange={(event) => updateAddressField(index, 'landmark', event.target.value)} onBlur={() => setTouchedFields((current) => ({ ...current, [`addressDetails.${index}.landmark`]: true }))} maxLength={100} required aria-invalid={Boolean(getVisibleAddressError(index, 'landmark', address.landmark, 'Landmark'))} />
                {getVisibleAddressError(index, 'landmark', address.landmark, 'Landmark') || inputFeedback[`addressDetails.${index}.landmark`] ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleAddressError(index, 'landmark', address.landmark, 'Landmark') || inputFeedback[`addressDetails.${index}.landmark`]}</p> : null}
              </label>
              <label className="lead-field">
                <span>City <em>*</em></span>
                <input aria-label={`Address ${index + 1} city`} value={address.city} onChange={(event) => updateAddressField(index, 'city', event.target.value)} onBlur={() => setTouchedFields((current) => ({ ...current, [`addressDetails.${index}.city`]: true }))} maxLength={100} required aria-invalid={Boolean(getVisibleAddressError(index, 'city', address.city, 'City'))} />
                {getVisibleAddressError(index, 'city', address.city, 'City') || inputFeedback[`addressDetails.${index}.city`] ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleAddressError(index, 'city', address.city, 'City') || inputFeedback[`addressDetails.${index}.city`]}</p> : null}
              </label>
              <label className="lead-field">
                <span>State <em>*</em></span>
                <input aria-label={`Address ${index + 1} state`} value={address.state} onChange={(event) => updateAddressField(index, 'state', event.target.value)} onBlur={() => setTouchedFields((current) => ({ ...current, [`addressDetails.${index}.state`]: true }))} maxLength={100} required aria-invalid={Boolean(getVisibleAddressError(index, 'state', address.state, 'State'))} />
                {getVisibleAddressError(index, 'state', address.state, 'State') || inputFeedback[`addressDetails.${index}.state`] ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleAddressError(index, 'state', address.state, 'State') || inputFeedback[`addressDetails.${index}.state`]}</p> : null}
              </label>
              <label className="lead-field">
                <span>PIN Code <em>*</em></span>
                <input aria-label={`Address ${index + 1} PIN code`} type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} title="Enter a valid 6-digit PIN code." value={address.pinCode} onChange={(event) => updateAddressField(index, 'pinCode', event.target.value)} onBlur={() => setTouchedFields((current) => ({ ...current, [`addressDetails.${index}.pinCode`]: true }))} required aria-invalid={Boolean(getVisibleAddressError(index, 'pinCode', address.pinCode, 'PIN Code'))} />
                {getVisibleAddressError(index, 'pinCode', address.pinCode, 'PIN Code') || inputFeedback[`addressDetails.${index}.pinCode`] ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleAddressError(index, 'pinCode', address.pinCode, 'PIN Code') || inputFeedback[`addressDetails.${index}.pinCode`]}</p> : null}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderLoanDetails = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px 20px' }}>
      <label className="lead-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span>Loan Product Type <em>*</em></span>
        <select name="loanProductType" value={form.loanProductType} onChange={handleChange} required={!initialData || Boolean(initialData.loanProductType || initialData.product)}>
          {getSelectPlaceholder('loanProductType')}
          {getLookupValues('loanProductType', form.loanProductType).map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
        </select>
      </label>

      <label className="lead-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span>Loan Amount <em>*</em></span>
        <input name="loanAmount" type="text" inputMode="numeric" pattern="[0-9]{1,12}" maxLength={12} value={form.loanAmount} onChange={handleChange} required={!initialData || Boolean(initialData.loanAmount || initialData.amount)} aria-invalid={Boolean(form.loanAmount && getFieldValidationMessage('loanAmount', form.loanAmount))} title="Enter a positive loan amount of up to 12 digits." style={{ minHeight: '42px' }} />
        {form.loanAmount && getFieldValidationMessage('loanAmount', form.loanAmount) ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getFieldValidationMessage('loanAmount', form.loanAmount)}</p> : null}
      </label>

      <label className="lead-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span>Purpose of Loan</span>
        <select name="loanPurpose" value={form.loanPurpose} onChange={handleChange} required={!initialData || Boolean(initialData.loanPurpose || initialData.purposeOfLoan)} style={{ minHeight: '42px' }}>
          {getSelectPlaceholder('loanPurpose')}
          {getLookupValues('loanPurpose', form.loanPurpose).map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
        </select>
      </label>
      {isOtherLoanPurpose ? (
        <label className="lead-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span>Specify Purpose of Loan <em>*</em></span>
          <input name="otherLoanPurpose" value={form.otherLoanPurpose} onChange={handleChange} maxLength={100} required title="Enter the specific purpose of the loan." aria-invalid={Boolean(getFieldValidationMessage('otherLoanPurpose', form.otherLoanPurpose))} />
          {getFieldValidationMessage('otherLoanPurpose', form.otherLoanPurpose) ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getFieldValidationMessage('otherLoanPurpose', form.otherLoanPurpose)}</p> : null}
        </label>
      ) : null}

      <label className="lead-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span>Down Payment <em>*</em></span>
        <input
          name="collateral"
          type="number"
          min="1"
          value={form.collateral}
          onChange={handleChange}
          required={!initialData || Boolean(initialData.collateral || initialData.downPaymentCollateral)}
          aria-invalid={Boolean(downPaymentError)}
          aria-describedby={downPaymentError ? 'lead-down-payment-error' : undefined}
          style={{ minHeight: '42px' }}
        />
        {downPaymentError ? <p id="lead-down-payment-error" role="alert" className="lead-inline-hint lead-inline-hint-error">{downPaymentError}</p> : null}
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px' }}>
        <label className="lead-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span>Tenure</span>
          <input name="tenure" type="number" min="1" value={form.tenure} onChange={handleChange} required={!initialData || Boolean(initialData.tenure)} style={{ minHeight: '42px' }} />
        </label>
        <label className="lead-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span>Unit</span>
          <select name="tenureUnit" value={form.tenureUnit} onChange={handleChange} style={{ minHeight: '42px' }} required>
            {getSelectPlaceholder('tenureUnit')}
            {getLookupValues('tenureUnit', form.tenureUnit, true).map((option) => <option key={option.id} value={normalizeLookupValue(option.name)}>{option.name}</option>)}
          </select>
        </label>
      </div>

      <label className="lead-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span>No. of Instalments</span>
        <input name="instalments" value={computedInstalments} readOnly style={{ minHeight: '42px', background: '#f6f8fa' }} />
      </label>

      <label className="lead-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span>Interest Rate (% p.a.) <em>*</em></span>
        <input name="interestRate" type="text" inputMode="decimal" pattern="([0-9]+([.][0-9]{1,2})?|[.][0-9]{1,2})" minLength={1} maxLength={6} value={form.interestRate} onChange={handleChange} required={!initialData || Boolean(initialData.interestRate)} aria-invalid={Boolean(form.interestRate && getFieldValidationMessage('interestRate', form.interestRate))} title="Enter an interest rate from 0 to 100 with up to 2 decimal places." style={{ minHeight: '42px' }} />
        {form.interestRate && getFieldValidationMessage('interestRate', form.interestRate) ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getFieldValidationMessage('interestRate', form.interestRate)}</p> : null}
      </label>

      <label className="lead-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span>Monthly EMI</span>
        <input name="monthlyEmi" value={computedMonthlyEmi ? formatCurrency(Number(computedMonthlyEmi)) : ''} readOnly style={{ minHeight: '42px', background: '#f6f8fa' }} />
        {calculatedEmi !== null ? <span style={{ color: '#708087', fontSize: '11px', fontWeight: 400 }}>{`Calculated over ${computedInstalments} months at ${annualInterestRate}% annual interest on the loan amount after down payment.`}</span> : null}
      </label>
      <label className="lead-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span>Total Interest</span>
        <input name="totalInterest" value={computedTotalInterest ? formatCurrency(Number(computedTotalInterest)) : ''} readOnly style={{ minHeight: '42px', background: '#f6f8fa' }} />
      </label>

      <label className="lead-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span>Total Amount</span>
        <input name="securityAmount" value={computedTotalAmount ? formatCurrency(Number(computedTotalAmount)) : ''} readOnly style={{ minHeight: '42px', background: '#f6f8fa' }} />
      </label>
      <label className="lead-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span>EMI Bounce</span>
        <select name="emiBounce" value={form.emiBounce} onChange={handleChange} style={{ minHeight: '42px' }}>
          <option value="">Select</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </label>
      {form.emiBounce === 'Yes' ? (
        <label className="lead-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span>No. of Bounce <em>*</em></span>
          <input name="noOfBounce" type="number" min="1" step="1" inputMode="numeric" value={form.noOfBounce} onChange={handleChange} required style={{ minHeight: '42px' }} />
        </label>
      ) : null}
    </div>
  );

  const renderIncomeProfile = () => (
    <div className="lead-income-content">
      <div className="lead-income-grid">
        <label className="lead-field">
          <span>Occupation</span>
          <select name="occupation" value={form.occupation} onChange={handleChange} aria-invalid={Boolean(getVisibleFieldError('occupation', form.occupation) || inputFeedback.occupation)}>
            {getSelectPlaceholder('occupation')}
            {getLookupValues('occupation', form.occupation).map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
          </select>
          {getVisibleFieldError('occupation', form.occupation) || inputFeedback.occupation ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleFieldError('occupation', form.occupation) || inputFeedback.occupation}</p> : null}
        </label>

        <label className="lead-field">
          <span>Employer Type</span>
          <select name="employerType" value={form.employerType} onChange={handleChange} aria-invalid={Boolean(getVisibleFieldError('employerType', form.employerType) || inputFeedback.employerType)}>
            {getSelectPlaceholder('employerType')}
            {getLookupValues('employerType', form.employerType).map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
          </select>
          {getVisibleFieldError('employerType', form.employerType) || inputFeedback.employerType ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleFieldError('employerType', form.employerType) || inputFeedback.employerType}</p> : null}
        </label>

        <label className="lead-field">
          <span>Employment Type <em>*</em></span>
          <select name="employmentType" value={form.employmentType} onChange={handleChange} required={!initialData || Boolean(initialData.employmentType)}>
            {getSelectPlaceholder('employmentType')}
            {getLookupValues('employmentType', form.employmentType).map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
          </select>
        </label>

        <label className="lead-field">
          <span>No. of Years of Service</span>
          <input name="yearsOfService" type="number" min="0" step="0.1" value={form.yearsOfService} onChange={handleChange} />
        </label>

        <label className="lead-field">
          <span>Designation</span>
          <input name="designation" value={form.designation} onChange={handleChange} disabled={isSelfEmployed} minLength={3} maxLength={50} title="Use 3-50 alphabetic characters; single spaces between words are allowed." aria-invalid={Boolean(form.designation && getFieldValidationMessage('designation', form.designation))} />
          {form.designation && getFieldValidationMessage('designation', form.designation) ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getFieldValidationMessage('designation', form.designation)}</p> : null}
        </label>

        <label className="lead-field">
          <span>Employer Name</span>
          <input name="employerName" value={form.employerName} onChange={handleChange} minLength={3} maxLength={100} title="Use 3-100 alphabetic characters; single spaces between words are allowed." aria-invalid={Boolean(getVisibleFieldError('employerName', form.employerName) || inputFeedback.employerName)} disabled={isSalariedOrEmployee} />
          {getVisibleFieldError('employerName', form.employerName) || inputFeedback.employerName ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getVisibleFieldError('employerName', form.employerName) || inputFeedback.employerName}</p> : null}
        </label>

        <label className="lead-field">
          <span>Emp Email ID</span>
          <input name="empEmailId" type="email" value={form.empEmailId} onChange={handleChange} maxLength={254} pattern={EMAIL_PATTERN} title="Enter a valid email address with a complete domain." aria-invalid={Boolean(form.empEmailId && getFieldValidationMessage('empEmailId', form.empEmailId))} />
          {form.empEmailId && getFieldValidationMessage('empEmailId', form.empEmailId) ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getFieldValidationMessage('empEmailId', form.empEmailId)}</p> : null}
        </label>

        <label className="lead-field">
          <span>Gross Income <em>*</em></span>
          <input name="annualIncome" type="number" min="1" step="0.01" value={form.annualIncome} onChange={handleChange} required={!initialData || Boolean(initialData.annualIncome)} aria-invalid={Boolean(form.annualIncome && getFieldValidationMessage('annualIncome', form.annualIncome))} />
          {form.annualIncome && getFieldValidationMessage('annualIncome', form.annualIncome) ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getFieldValidationMessage('annualIncome', form.annualIncome)}</p> : null}
        </label>

        <label className="lead-field">
          <span>Net Income</span>
          <input name="takeHomePay" type="number" min="0" step="0.01" value={form.takeHomePay} onChange={handleChange} aria-invalid={Boolean(form.takeHomePay && getFieldValidationMessage('takeHomePay', form.takeHomePay))} />
          {form.takeHomePay && getFieldValidationMessage('takeHomePay', form.takeHomePay) ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{getFieldValidationMessage('takeHomePay', form.takeHomePay)}</p> : null}
        </label>

      </div>

      {[
        ['existingBankCreditFacilities', 'Current Credit Facility with existing Bank'],
        ['otherBankCreditFacilities', 'Current Credit Facility with other Banks'],
      ].map(([collection, title]) => (
        <div className="lead-table-section" key={collection}>
          <div className="lead-table-heading">
            <h4>{title}</h4>
            <button type="button" className="lead-table-add" onClick={() => addCreditFacility(collection)}>
              <Plus size={14} /> Add facility
            </button>
          </div>
          {creditFacilityErrors[collection] ? <p className="lead-inline-hint lead-inline-hint-error" role="alert">{creditFacilityErrors[collection]}</p> : null}
          <div className="lead-data-table-wrap lead-income-table-wrap">
            <table className="lead-data-table lead-income-table">
              <thead>
                {collection === 'existingBankCreditFacilities' ? (
                  <tr>
                    <th scope="col">Sr</th>
                    <th scope="col">Account Number</th>
                    <th scope="col">Loan Type</th>
                    <th scope="col">Limit</th>
                    <th scope="col">EMI</th>
                    <th scope="col">Outstanding</th>
                    <th scope="col">DPD</th>
                    <th scope="col">A/c Status</th>
                    <th scope="col">Action</th>
                  </tr>
                ) : (
                  <tr>
                    <th scope="col">Sr</th>
                    <th scope="col">Bank Name</th>
                    <th scope="col">A/c No</th>
                    <th scope="col">Loan Type</th>
                    <th scope="col">Limit</th>
                    <th scope="col">EMI</th>
                    <th scope="col">Outstanding</th>
                    <th scope="col">Stmt Request</th>
                    <th scope="col">Action</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {form[collection].map((facility, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    {collection === 'existingBankCreditFacilities' ? (
                      <>
                        <td><input aria-label={`${title} ${index + 1} account number`} value={facility.accountNumber} maxLength={30} onChange={(event) => updateRow(collection, index, 'accountNumber', event.target.value)} /></td>
                        <td><input aria-label={`${title} ${index + 1} loan type`} value={facility.loanType} maxLength={50} onChange={(event) => updateRow(collection, index, 'loanType', event.target.value)} /></td>
                        <td><input aria-label={`${title} ${index + 1} limit`} type="number" min="0" step="0.01" value={facility.limit} onChange={(event) => updateRow(collection, index, 'limit', event.target.value)} /></td>
                        <td><input aria-label={`${title} ${index + 1} EMI`} type="number" min="0" step="0.01" value={facility.emi} onChange={(event) => updateRow(collection, index, 'emi', event.target.value)} /></td>
                        <td><input aria-label={`${title} ${index + 1} outstanding`} type="number" min="0" step="0.01" value={facility.outstanding} onChange={(event) => updateRow(collection, index, 'outstanding', event.target.value)} /></td>
                        <td><input aria-label={`${title} ${index + 1} DPD`} type="number" min="0" step="1" value={facility.dpd} onChange={(event) => updateRow(collection, index, 'dpd', event.target.value)} /></td>
                        <td><input aria-label={`${title} ${index + 1} account status`} value={facility.accountStatus} maxLength={50} onChange={(event) => updateRow(collection, index, 'accountStatus', event.target.value)} /></td>
                      </>
                    ) : (
                      <>
                        <td><input aria-label={`${title} ${index + 1} bank name`} value={facility.bankName} maxLength={100} onChange={(event) => updateRow(collection, index, 'bankName', event.target.value)} /></td>
                        <td><input aria-label={`${title} ${index + 1} account number`} value={facility.accountNumber} maxLength={30} onChange={(event) => updateRow(collection, index, 'accountNumber', event.target.value)} /></td>
                        <td><input aria-label={`${title} ${index + 1} loan type`} value={facility.loanType} maxLength={50} onChange={(event) => updateRow(collection, index, 'loanType', event.target.value)} /></td>
                        <td><input aria-label={`${title} ${index + 1} limit`} type="number" min="0" step="0.01" value={facility.limit} onChange={(event) => updateRow(collection, index, 'limit', event.target.value)} /></td>
                        <td><input aria-label={`${title} ${index + 1} EMI`} type="number" min="0" step="0.01" value={facility.emi} onChange={(event) => updateRow(collection, index, 'emi', event.target.value)} /></td>
                        <td><input aria-label={`${title} ${index + 1} outstanding`} type="number" min="0" step="0.01" value={facility.outstanding} onChange={(event) => updateRow(collection, index, 'outstanding', event.target.value)} /></td>
                        <td>
                          <button
                            type="button"
                            onClick={() => updateRow(collection, index, 'statementRequested', !facility.statementRequested)}
                          >
                            {facility.statementRequested ? 'Cancel request' : 'Request'}
                          </button>
                        </td>
                      </>
                    )}
                    <td>
                      <button type="button" onClick={() => removeRow(collection, index)} aria-label={`Delete ${title} ${index + 1}`}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="lead-income-actions" aria-label="Income and credit checks">
        <button type="button">Fixed Obligation to Income Ratio – FOIR</button>
        <button type="button">Loan-to-Value – LTV</button>
        <button type="button">Debt-to-Income – DTI</button>
        <button type="button">CIBIL Check</button>
      </div>
    </div>
  );

  const renderReferralDetails = () => (
    <div className="lead-referral-grid">
      {(() => {
        const acquisitionChannel = normalizeLookupValue(form.acquisitionChannel);
        const referralEnabled = acquisitionChannel === 'bankgenerated' || acquisitionChannel === 'branch';
        return <>
      <label className="lead-field lead-referral-channel">
        <span>Lead Acquisition Channel <em>*</em></span>
  
<select
  name="acquisitionChannel"
  value={form.acquisitionChannel}
  onChange={handleChange}
  required={!initialData || Boolean(initialData.acquisitionChannel || initialData.leadAcquisitionChannel)}
>
  {getSelectPlaceholder('acquisitionChannel')}
  {getLookupValues('acquisitionChannel', form.acquisitionChannel).map((option) => (
    <option key={option.id} value={option.name}>
      {option.name}
    </option>
  ))}
</select>

      </label>

      <label className="lead-field lead-referral-date">
        <span>Date</span>
        <LeadDatePicker
          id="lead-referral-date"
          name="referralDate"
          label="Referral Date"
          value={form.referralDate}
          onChange={(value) => handleChange({ target: { name: 'referralDate', value } })}
          disabled={!referralEnabled}
        />
      </label>

      <label className="lead-field lead-referral-partner-id">
        <span>Sourcing Agent / Partner ID</span>
        <input name="partnerId" value={form.partnerId} onChange={handleChange} disabled={!referralEnabled} />
      </label>

      <label className="lead-field lead-referral-partner-name">
        <span>Agent / Partner Name</span>
        <input name="partnerName" value={form.partnerName} onChange={handleChange} disabled={!referralEnabled} />
      </label>

      <label className="lead-field lead-referral-employee-id">
        <span>Emp ID</span>
        <input name="employeeId" value={form.employeeId} onChange={handleChange} disabled={!referralEnabled} />
      </label>

      <label className="lead-field lead-referral-employee-name">
        <span>Emp Name</span>
        <input name="employeeName" value={form.employeeName} onChange={handleChange} disabled={!referralEnabled} />
      </label>

         </>;
      })()}
    </div>
  );

  const renderFooter = () => (
    <div className={`loan-form-actions lead-modal-footer${activeStep === 0 ? ' first-step' : ''}`}>
      {activeStep > 0 && (
        <button type="button" className="loan-back-button" onClick={() => setActiveStep((current) => current - 1)}>
          <ChevronLeft size={16} /> Previous
        </button>
      )}

      {activeStep < steps.length - 1 ? (
        <button type="button" className="loan-continue-button" onClick={handleNext}>
          Next <ChevronRight size={16} />
        </button>
      ) : (
        <button type="button" className="loan-continue-button" onClick={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : initialData ? 'Save Changes' : 'Save and Submit'}
        </button>
      )}
    </div>
  );

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setSubmissionError('');

    if (!validateStep()) return;

    const customerName = [form.namePrefix, form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ').trim();
    const leadData = {
      ...form,
      customerName,
      name: customerName,
      age: computedAge,
      customerType: computedCustomerType,
      instalments: computedInstalments,
      monthlyEmi: computedMonthlyEmi,
      totalInterest: computedTotalInterest,
      securityAmount: computedTotalAmount,
      status: initialData ? form.status : 'Pending',
    };
    delete leadData.otpNumber;
    delete leadData.panOtpNumber;
    delete leadData.otpSent;

    setIsSubmitting(true);
    try {
      if (initialData) await onUpdate(leadData);
      else await onCreate(leadData);
      resetAndClose(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save the lead.';
      setSubmissionError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="loan-application-shell lead-full-page">
      <style>{newLeadInlineStyles}</style>
      <div className="loan-onboarding-heading" style={{ marginTop: '-15px', marginBottom: '26px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, color: '#23474C', font: '700 23px Manrope' }}>
          {initialData ? `Edit Lead ${initialData.id}` : 'Add Lead'}
        </h1>
        <button
          type="button"
          className="loan-back-button"
          style={{ height: '32px', minWidth: 'auto', padding: '0 10px', gap: '5px', fontSize: '13px', background: '#368262', borderColor: '#368262', color: '#fff' }}
          onClick={() => resetAndClose()}
          disabled={isSubmitting}
        >
          <ArrowLeft size={14} />
          Back 
        </button>
      </div>
      <div className="lead-page-content">
        <form className="lead-form" onSubmit={(event) => event.preventDefault()}>
          {isLoadingLookups ? <p role="status">Loading dropdown values...</p> : null}
          {lookupError ? <p className="lead-submit-error" role="alert">{lookupError}</p> : null}
          {submissionError ? <p className="lead-submit-error" role="alert">{submissionError}</p> : null}
          <div className="loan-application-card lead-onboarding-card">
            <nav className="loan-stepper" aria-label="Lead form steps">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <button
                    type="button"
                    key={step.title}
                    className={`loan-step${index === activeStep ? ' active' : ''}${index < activeStep ? ' done' : ''}`}
                    onClick={() => index < activeStep && setActiveStep(index)}
                    aria-current={index === activeStep ? 'step' : undefined}
                    aria-label={`Step ${index + 1}: ${step.title}`}
                    disabled={index > activeStep}
                  >
                    <span className="loan-step-bubble">
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span className="loan-step-text">{step.title}</span>
                  </button>
                );
              })}
            </nav>

            <section className="lead-step-panel loan-form-section" aria-labelledby="lead-step-title">
              <h2 id="lead-step-title">{steps[activeStep].title}</h2>
              {activeStep === 0 && renderPersonalDetails()}
              {activeStep === 1 && renderAddressDetails()}
              {activeStep === 2 && renderLoanDetails()}
              {activeStep === 3 && renderIncomeProfile()}
              {activeStep === 4 && renderReferralDetails()}
              {renderFooter()}
            </section>
          </div>
        </form>
      </div>
    </main>
  );
}
