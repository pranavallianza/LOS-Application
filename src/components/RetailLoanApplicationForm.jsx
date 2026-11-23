'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import AppShell from './AppShell';
import Card from './Card';
import PageHeader from './PageHeader';
import LeadDatePicker from './LeadDatePicker';
import { getApplicationId, getCustomerName } from './GoldLoanApplication';
import { getLookupOptions, getLookupTypes } from '../services/lookups';
import { RETAIL_LOAN_LOOKUP_OPTIONS } from '../data/retailLoanLookups';

export const RETAIL_LOAN_STORAGE_KEY = 'los.retailLoanApplications';

const RETAIL_STEPS = [
  'Borrower Details',
  'Related Party',
  'Loan Details',
  'Repayment Chart',
  'Basic Details',
  'Security Details',
  'Insurance Details',
  'Disbursement',
];
const RETAIL_STEP_ICONS = [
  UserRound,
  UsersRound,
  Landmark,
  BarChart3,
  WalletCards,
  ShieldCheck,
  WalletCards,
  Landmark,
];
const REPAYMENT_PAGE_SIZE = 12;

let nextPartySequence = 1;
const blankRelatedParty = () => ({
  id: `party-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${nextPartySequence++}`,
  nameType: '',
  relation: '',
  customerNo: '',
  salutation: '',
  firstName: '',
  middleName: '',
  lastName: '',
});

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

function dateAfter(value) {
  if (!isValidDate(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const nextDate = new Date(year, month - 1, day + 1);
  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
}

function addMonthsToDate(value, months) {
  if (!isValidDate(value) || !Number.isInteger(months)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const targetMonth = year * 12 + month - 1 + months;
  const targetYear = Math.floor(targetMonth / 12);
  const targetMonthIndex = targetMonth % 12;
  const lastDay = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function calculateInstalmentEndDate(startDate, tenureMonths) {
  const tenure = Number(tenureMonths);
  if (!String(tenureMonths ?? '').trim() || !Number.isInteger(tenure) || tenure <= 0) return '';
  return addMonthsToDate(startDate, tenure);
}

function formatDateText(value) {
  if (!isValidDate(value)) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getTodayDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '-][\p{L}\p{M}]+)*$/u;
const NAME_INPUT_PATTERN = /^[\p{L}\p{M} '-]*$/u;
const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const CODE_INPUT_PATTERN = /^[A-Za-z0-9_-]*$/;
const TEXT_PATTERN = /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 .,'&()/-]*$/u;
const ADDRESS_PATTERN = /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 .,'&#()/:+-]*$/u;
const REMARKS_PATTERN = /^[\p{L}\p{M}0-9 .,'&#()/:+-]*$/u;
const INPUT_VALIDATION = {
  loanAccountNumber: [CODE_INPUT_PATTERN, 'Use letters, numbers, hyphens, and underscores only.'],
  firstName: [NAME_INPUT_PATTERN, 'Use letters, spaces, apostrophes, or hyphens only.'],
  middleName: [NAME_INPUT_PATTERN, 'Use letters, spaces, apostrophes, or hyphens only.'],
  lastName: [NAME_INPUT_PATTERN, 'Use letters, spaces, apostrophes, or hyphens only.'],
  sanctioningAuthority: [NAME_INPUT_PATTERN, 'Use letters, spaces, apostrophes, or hyphens only.'],
  productCode: [CODE_INPUT_PATTERN, 'Use letters, numbers, hyphens, and underscores only.'],
  schemeCode: [CODE_INPUT_PATTERN, 'Use letters, numbers, hyphens, and underscores only.'],
  securityId: [CODE_INPUT_PATTERN, 'Use letters, numbers, hyphens, and underscores only.'],
  city: [/^[A-Za-z\s]*$/, 'City must contain alphabetic characters and spaces only.'],
  state: [/^[A-Za-z\s]*$/, 'State must contain alphabetic characters and spaces only.'],
  pincode: [/^\d*$/, 'PIN code must contain digits only.'],
  valuerName: [NAME_INPUT_PATTERN, 'Use letters, spaces, apostrophes, or hyphens only.'],
  policyNumber: [/^[A-Za-z0-9/-]*$/, 'Use letters, numbers, hyphens, or slashes only.'],
  disbursementAccountNumber: [/^\d*$/, 'Account number must contain digits only.'],
  ifscCode: [/^[A-Za-z0-9]*$/, 'IFSC code must contain letters and numbers only.'],
  beneficiaryMobileNumber: [/^\d*$/, 'Mobile number must contain digits only.'],
};
const BASIC_DETAILS_LOOKUPS = {
  purposeCode: { label: 'Purpose Code', aliases: ['purposecode', 'purpose', 'purposeofloan', 'purposeloan'], useCodeValue: true },
  prioritySector: { label: 'Priority Sector', aliases: ['prioritysector', 'prioritysectorflag', 'prioritysectoryn', 'yesno', 'yesorno'] },
  prioritySectorCode: { label: 'Priority Code', aliases: ['prioritysectorcode', 'prioritycode', 'sectorcode'], useCodeValue: true },
  industryType: { label: 'Industry Type', aliases: ['industrytype', 'industry'] },
  industrySubType: { label: 'Industry Sub Type', aliases: ['industrysubtype', 'subindustrytype', 'subsector', 'subsectorcode'] },
  physicallyChallenged: { label: 'Physically Challenged', aliases: ['physicallychallenged', 'physicallychallengedyn', 'disabilitystatus', 'yesno', 'yesorno'] },
  termCode: {
    label: 'Term Code',
    aliases: [
      'termcode',
      'loantermcode',
      'term',
      'terms',
      'loanterm',
      'loanterms',
      'loantermtype',
      'termtype',
      'tenure',
      'tenurecode',
      'tenuretype',
      'loantenure',
      'loantenurecode',
      'loantenuretype',
      'repaymentterm',
      'repaymenttermcode',
      'loanrepaymentterm',
      'termcategory',
      'tenurecategory',
    ],
    useCodeValue: true,
  },
};
const TEMPORARY_BASIC_DETAILS_OPTIONS = {
  purposeCode: ['FAMILY', 'BUSINESS', 'EDUCATION', 'MEDICAL'],
  prioritySector: ['Yes', 'No'],
  prioritySectorCode: ['RETAIL'],
  industryType: ['Agriculture', 'Manufacturing', 'Services', 'Retail', 'Other'],
  industrySubType: ['Gold', 'Agriculture', 'Manufacturing', 'Trading', 'Other'],
  physicallyChallenged: ['Yes', 'No'],
  termCode: ['SHORT', 'MEDIUM'],
};
const normalizeLookupName = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ACCOUNT_STATUS_OPTIONS = ['Draft', 'Pending', 'In review', 'Approved', 'Disbursed', 'Awaiting KYC', 'Returned', 'Rejected', 'Active', 'Closed'];
const MODE_OF_OPERATION_OPTIONS = ['Single', 'Joint', 'Either or Survivor', 'Anyone or Survivor'];
const PARTY_NAME_TYPE_OPTIONS = ['Applicant', 'Guarantor', 'Co-applicant', 'Nominee'];
const PARTY_RELATION_OPTIONS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Other'];
const SALUTATION_OPTIONS = ['Mr', 'Mrs', 'Ms', 'Dr'];
function isValidAmount(value) {
  const text = String(value ?? '').trim();
  return /^(?:\d+)(?:\.\d{1,2})?$/.test(text)
    && Number.isFinite(Number(text))
    && Number(text) > 0;
}

function getSynchronizedSecurityValue(value) {
  return isValidAmount(value) ? String(value).trim() : '';
}

function isValidPercentage(value) {
  const text = String(value ?? '').trim();
  return /^(?:\d+)(?:\.\d{1,2})?$/.test(text)
    && Number.isFinite(Number(text))
    && Number(text) >= 0
    && Number(text) <= 100;
}

function calculateTotalInterestRate(interestRate, offsetRate) {
  const interest = String(interestRate ?? '').trim();
  const offset = String(offsetRate ?? '').trim();
  if (!interest || !isValidPercentage(interest) || (offset && !isValidPercentage(offset))) return '';
  const total = Number(interest) + (offset ? Number(offset) : 0);
  return String(Math.round(total * 100) / 100);
}

export function calculateInstalmentAmount(loanAmount, tenureMonths, totalInterestRate) {
  const amountText = String(loanAmount ?? '').trim();
  const tenureText = String(tenureMonths ?? '').trim();
  const rateText = String(totalInterestRate ?? '').trim();
  const amount = Number(amountText);
  const tenure = Number(tenureText);
  const annualRate = Number(rateText);

  if (
    !amountText
    || !tenureText
    || !rateText
    || !Number.isFinite(amount)
    || amount <= 0
    || !Number.isInteger(tenure)
    || tenure <= 0
    || !isValidPercentage(rateText)
    || !Number.isFinite(annualRate)
  ) {
    return '';
  }

  const monthlyRate = annualRate / 1200;
  const payment = monthlyRate === 0
    ? amount / tenure
    : amount * monthlyRate / (1 - ((1 + monthlyRate) ** -tenure));

  return Number.isFinite(payment) ? payment.toFixed(2) : '';
}

function validateText(value, label, { required = false, minLength = 3, maxLength = 50, pattern = TEXT_PATTERN } = {}) {
  const text = String(value ?? '').trim();
  if (!text) return required ? `${label} is required.` : '';
  if (text.length < minLength || text.length > maxLength) {
    return `${label} must be between ${minLength} and ${maxLength} characters.`;
  }
  if (!pattern.test(text)) return `Enter a valid ${label.toLowerCase()}.`;
  return '';
}

function validateCode(value, label, { required = false, minLength = 3, maxLength = 30 } = {}) {
  const text = String(value ?? '').trim();
  if (!text) return required ? `${label} is required.` : '';
  if (text.length < minLength || text.length > maxLength || !CODE_PATTERN.test(text)) {
    return `${label} must be 3–30 characters and contain only letters, numbers, hyphens, or underscores.`;
  }
  return '';
}

function validatePolicyNumber(value) {
  const raw = String(value ?? '');
  const text = raw.trim();
  if (!text) return 'Policy number is required.';
  if (/\s/.test(raw)) return 'Spaces are not allowed in policy number.';
  if (!/^[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)*$/.test(text)) {
    return 'Enter a valid alphanumeric policy number.';
  }
  if (text.length < 5 || text.length > 25) {
    return 'Policy number must be between 5 and 25 characters.';
  }
  return '';
}

function validateAmount(value, label, required = false) {
  const text = String(value ?? '').trim();
  if (!text) return required ? `${label} is required.` : '';
  return isValidAmount(text) ? '' : `${label} must be a positive amount with up to 2 decimal places.`;
}

function validateRate(value, label, required = false) {
  const text = String(value ?? '').trim();
  if (!text) return required ? `${label} is required.` : '';
  return isValidPercentage(text) ? '' : `${label} must be between 0 and 100%.`;
}

function validateDate(value, label, required = false) {
  const text = String(value ?? '').trim();
  if (!text) return required ? `${label} is required.` : '';
  return isValidDate(text) ? '' : `Enter a valid ${label.toLowerCase()}.`;
}

function addCurrentValueToOptions(options, currentValue) {
  return currentValue && !options.includes(currentValue)
    ? [currentValue, ...options]
    : options;
}

function validateRelatedParty(party, index) {
  const errors = {};
  const prefix = `relatedParties.${index}.`;
  if (!PARTY_NAME_TYPE_OPTIONS.includes(party.nameType)) {
    errors[`${prefix}nameType`] = 'Select a valid name type.';
  }
  if (!PARTY_RELATION_OPTIONS.includes(party.relation)) {
    errors[`${prefix}relation`] = 'Select a valid relation.';
  }
  errors[`${prefix}customerNo`] = validateCode(party.customerNo, 'Customer number', { required: true });
  if (!SALUTATION_OPTIONS.includes(party.salutation)) {
    errors[`${prefix}salutation`] = 'Select a valid salutation.';
  }
  errors[`${prefix}firstName`] = validateText(party.firstName, 'First name', { required: true, pattern: NAME_PATTERN });
  errors[`${prefix}middleName`] = validateText(party.middleName, 'Middle name', { pattern: NAME_PATTERN });
  errors[`${prefix}lastName`] = validateText(party.lastName, 'Last name', { required: true, pattern: NAME_PATTERN });
  return Object.fromEntries(Object.entries(errors).filter(([, error]) => error));
}

function getRelatedPartyFieldLabel(field) {
  const labels = {
    nameType: 'Name Type',
    relation: 'Relation',
    customerNo: 'Customer No',
    salutation: 'Salutation',
    firstName: 'First Name',
    middleName: 'Middle Name',
    lastName: 'Last Name',
  };
  return labels[field] || field;
}

function validateDisbursementField(form, field, fieldValue = form[field]) {
  const rawValue = String(fieldValue ?? '');
  const value = rawValue.trim();
  const requiredMessages = {
    disbursementMode: 'Payment mode is required.',
    disbursementAccountNumber: 'Account number is required.',
    ifscCode: 'IFSC code is required.',
    bankName: 'Bank name is required.',
    beneficiaryAccountName: 'Account name is required.',
    beneficiaryMobileNumber: 'Mobile number is required.',
    disbursementAmount: 'Amount is required.',
  };

  if (!value) return requiredMessages[field] || '';

  if (field === 'disbursementMode') {
    return ['NEFT', 'RTGS', 'IMPS', 'Cheque'].includes(value)
      ? ''
      : 'Select a valid payment mode.';
  }
  if (field === 'disbursementAccountNumber') {
    if (!/^\d+$/.test(rawValue)) return 'Account number must contain digits only.';
    if (rawValue.length < 9) return 'Account number must contain at least 9 digits.';
    if (rawValue.length > 18) return 'Account number cannot exceed 18 digits.';
  }
  if (field === 'ifscCode' && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(value)) {
    return 'Enter a valid 11-character IFSC code.';
  }
  if (field === 'bankName') {
    if (value.length < 3) return 'Bank name must contain at least 3 characters.';
    if (value.length > 50) return 'Bank name cannot exceed 50 characters.';
    if (!TEXT_PATTERN.test(value)) return 'Enter a valid bank name.';
  }
  if (field === 'beneficiaryAccountName') {
    if (value.length < 3) return 'Account name must contain at least 3 characters.';
    if (value.length > 50) return 'Account name cannot exceed 50 characters.';
    if (!TEXT_PATTERN.test(value)) return 'Enter a valid account name.';
  }
  if (field === 'beneficiaryMobileNumber' && !/^[6-9]\d{9}$/.test(rawValue)) {
    return 'Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.';
  }
  if (field === 'disbursementAmount') {
    if (!/^\d+(\.\d{1,2})?$/.test(rawValue) || !Number.isFinite(Number(rawValue))) {
      return 'Enter a valid amount with up to 2 decimal places.';
    }
    if (Number(rawValue) <= 0) return 'Amount must be greater than zero.';
  }
  return '';
}

export function createInitialRetailLoanForm(application) {
  const savedForm = application?.retailLoanForm
    && typeof application.retailLoanForm === 'object'
    && !Array.isArray(application.retailLoanForm)
    ? application.retailLoanForm
    : {};
  const goldLoan = application?.goldLoanForm
    && typeof application.goldLoanForm === 'object'
    && !Array.isArray(application.goldLoanForm)
    ? application.goldLoanForm
    : {};
  const savedCustomerName = application ? getCustomerName(application) : '';
  const nameParts = savedCustomerName && savedCustomerName !== 'Not available'
    ? savedCustomerName.split(/\s+/).filter(Boolean)
    : [];

  const retailProductName = application?.productName
    || goldLoan.productName
    || (application?.product && !/gold/i.test(application.product) ? application.product : '');
  const retailProductCode = application?.productCode || goldLoan.productCode || '';
  const retailSchemeCode = application?.schemeCode || goldLoan.schemeCode || '';
  const retailSchemeDesc = application?.schemeDescription || goldLoan.schemeDescription || '';

  const rawAccountNo = application?.loanAccountNumber || goldLoan.loanAccountNumber || '';
  const retailAccountNo = rawAccountNo ? rawAccountNo.replace(/^GLA-/i, 'RLA-') : '';

  const initialAmount = String(application?.amount ?? goldLoan.sanctionLimit ?? '').replace(/[^\d.]/g, '');

  const initialForm = {
    loanAccountNumber: retailAccountNo,
    effectiveDate: application?.effectiveDate || goldLoan.effectiveDate || application?.applicationDate || '',
    customerId: application?.customerId || goldLoan.customerId || '',
    branch: application?.branch || goldLoan.branch || '',
    title: application?.title || goldLoan.title || '',
    firstName: nameParts[0] || goldLoan.firstName || '',
    middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : (goldLoan.middleName || ''),
    lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : (goldLoan.lastName || ''),
    productCode: retailProductCode,
    productName: retailProductName,
    schemeCode: retailSchemeCode,
    schemeDescription: retailSchemeDesc,
    accountStatus: application?.accountStatus || goldLoan.accountStatus || application?.status || '',
    modeOfOperation: application?.modeOfOperation || goldLoan.modeOfOperation || '',
    lastTransactionDate: application?.lastTransactionDate || goldLoan.lastTransactionDate || application?.applicationDate || '',
    sanctionedDate: application?.sanctionedDate || goldLoan.sanctionedDate || application?.applicationDate || '',
    loanAmount: initialAmount,
    interestRate: application?.interestRate || goldLoan.interestRate || '',
    offsetRate: application?.offsetRate || '',
    totalInterestRate: application?.totalInterestRate || '',
    moratorium: application?.moratorium || '',
    expiryDate: application?.expiryDate || goldLoan.expiryDate || '',
    instalmentAmount: application?.instalmentAmount || goldLoan.instalmentAmount || '',
    instalmentStartDate: application?.instalmentStartDate || goldLoan.repaymentStartDate || '',
    sanctioningAuthority: application?.sanctioningAuthority || goldLoan.sanctionAuthority || '',
    tenureMonths: application?.tenureMonths || goldLoan.tenureMonths || '',
    emiType: application?.emiType || '',
    bulletPayment: application?.bulletPayment || '',
    instalmentEndDate: application?.instalmentEndDate || application?.expiryDate || goldLoan.expiryDate || '',
    purposeCode: application?.purposeCode || goldLoan.basicDetails?.purposeLoan || '',
    prioritySector: application?.prioritySector || (goldLoan.basicDetails?.womenSector === 'Yes' ? 'Yes' : ''),
    prioritySectorCode: application?.prioritySectorCode || goldLoan.basicDetails?.sectorCode || '',
    industryType: application?.industryType || '',
    industrySubType: application?.industrySubType || '',
    physicallyChallenged: application?.physicallyChallenged || '',
    termCode: application?.termCode || goldLoan.basicDetails?.termCode || '',
    securityId: application?.securityId || goldLoan.security?.securityId || '',
    securityType: application?.securityType || '',
    securityEffectiveDate: application?.securityEffectiveDate || application?.effectiveDate || goldLoan.effectiveDate || '',
    assetType: application?.assetType || '',
    securityAmount: application?.securityAmount || goldLoan.security?.limitAvailable || '',
    marginPercent: application?.marginPercent || goldLoan.security?.marginPercent || '',
    assetAddress: application?.assetAddress || '',
    assetAddressLine2: application?.assetAddressLine2 || '',
    city: application?.city || '',
    state: application?.state || '',
    pincode: application?.pincode || '',
    valuationAmount: application?.valuationAmount || '',
    valuerName: application?.valuerName || goldLoan.security?.valuerDescription || '',
    valuationDate: application?.valuationDate || application?.effectiveDate || goldLoan.effectiveDate || '',
    inspectionBy: application?.inspectionBy || '',
    inspectionDate: application?.inspectionDate || application?.effectiveDate || goldLoan.effectiveDate || '',
    inspectionReportName: application?.inspectionReportName || '',
    securityValue: application?.securityValue || '',
    insuranceCompany: application?.insuranceCompany || '',
    policyType: application?.policyType || '',
    premiumFrequency: application?.premiumFrequency || '',
    policyStatus: application?.policyStatus || '',
    autoRenew: application?.autoRenew || '',
    policyNumber: application?.policyNumber || '',
    insuranceIssueDate: application?.insuranceIssueDate || application?.effectiveDate || goldLoan.effectiveDate || '',
    premiumAmount: application?.premiumAmount || '',
    sumAssured: application?.sumAssured || '',
    insuranceExpiryDate: application?.insuranceExpiryDate || application?.expiryDate || goldLoan.expiryDate || '',
    disbursementAccountNumber: application?.disbursementAccountNumber || goldLoan.disbursement?.accountNumber || '',
    bankName: application?.bankName || goldLoan.disbursement?.bankName || '',
    ifscCode: application?.ifscCode || goldLoan.disbursement?.ifscCode || '',
    disbursementMode: application?.disbursementMode || goldLoan.disbursement?.mode || '',
    disbursementAmount: application?.disbursementAmount || goldLoan.disbursement?.amount || initialAmount,
    beneficiaryAccountName: application?.beneficiaryAccountName || goldLoan.disbursement?.accountName || '',
    beneficiaryMobileNumber: application?.beneficiaryMobileNumber || goldLoan.disbursement?.mobileNumber || '',
    remarks: application?.remarks || goldLoan.disbursement?.remarks || '',
    relatedParties: Array.isArray(savedForm.relatedParties)
      ? savedForm.relatedParties.map((party) => ({ ...blankRelatedParty(), ...party }))
      : Array.isArray(goldLoan.relatedParties)
        ? goldLoan.relatedParties.map((party) => ({ ...blankRelatedParty(), ...party }))
        : [blankRelatedParty()],
  };

  const savedFormFields = Object.fromEntries(
    Object.entries(savedForm).filter(([key]) => key !== 'disbursementAccountType'),
  );
  const formFields = Object.keys(initialForm).filter((key) => key !== 'relatedParties');
  const numericFields = new Set([
    'loanAmount',
    'interestRate',
    'offsetRate',
    'totalInterestRate',
    'moratorium',
    'instalmentAmount',
    'tenureMonths',
    'bulletPayment',
    'securityAmount',
    'marginPercent',
    'valuationAmount',
    'securityValue',
    'premiumAmount',
    'sumAssured',
    'disbursementAmount',
  ]);
  const applicationFields = Object.fromEntries(
    formFields
      .filter((key) => (
        application?.[key] !== undefined
        && application?.[key] !== null
        && !(typeof application[key] === 'string' && !application[key].trim())
      ))
      .map((key) => [
        key,
        numericFields.has(key)
          ? String(application[key]).replace(/[^\d.-]/g, '')
          : application[key],
      ]),
  );

  const mergedForm = {
    ...initialForm,
    ...applicationFields,
    ...savedFormFields,
    relatedParties: Array.isArray(savedForm.relatedParties)
      ? savedForm.relatedParties.map((party) => ({ ...blankRelatedParty(), ...party }))
      : initialForm.relatedParties,
  };

  if (!mergedForm.relatedParties.length) mergedForm.relatedParties = [blankRelatedParty()];
  mergedForm.totalInterestRate = calculateTotalInterestRate(mergedForm.interestRate, mergedForm.offsetRate);
  mergedForm.instalmentAmount = calculateInstalmentAmount(
    mergedForm.loanAmount,
    mergedForm.tenureMonths,
    mergedForm.totalInterestRate,
  );
  mergedForm.instalmentEndDate = calculateInstalmentEndDate(
    mergedForm.instalmentStartDate,
    mergedForm.tenureMonths,
  );
  mergedForm.securityValue = getSynchronizedSecurityValue(mergedForm.securityAmount);
  return mergedForm;
}

export function readSavedRetailLoanApplications() {
  if (typeof window === 'undefined') return [];
  const value = window.localStorage.getItem(RETAIL_LOAN_STORAGE_KEY);
  if (!value) return [];

  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error('Saved Retail Loan applications have an invalid format.');
  }
  return parsed;
}

export function persistRetailLoanApplication(application) {
  if (typeof window === 'undefined') return;
  const saved = readSavedRetailLoanApplications().filter(
    (record) => getApplicationId(record) !== getApplicationId(application),
  );
  window.localStorage.setItem(
    RETAIL_LOAN_STORAGE_KEY,
    JSON.stringify([...saved, application]),
  );
}

function RetailField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  options,
  error,
  required = false,
  readOnly = false,
  placeholder,
  className = '',
  inputPattern,
  invalidInputMessage,
  ...inputProps
}) {
  const [inputError, setInputError] = useState('');
  const inputId = `field-${name}`;
  const fieldError = inputError || error
    ? `Enter valid ${label}.`
    : '';
  useEffect(() => {
    setInputError('');
  }, [value]);
  const handleInputChange = (nextValue) => {
    if (inputPattern && !inputPattern.test(nextValue)) {
      setInputError(invalidInputMessage || `Enter a valid ${label.toLowerCase()}.`);
      return;
    }
    setInputError('');
    onChange(name, nextValue);
  };
  return (
    <div
      className={`retail-field ${fieldError ? 'has-error' : ''} ${className}`}
      onBlurCapture={type === 'date' ? (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) inputProps.onBlur?.(event);
      } : undefined}
    >
      <label htmlFor={inputId} className="retail-field-label">
        <span>{label}</span>
        {required && <span className="retail-required" aria-hidden="true"> *</span>}
      </label>
      {options ? (
        <div className="retail-select-wrapper">
          <select
            id={inputId}
            name={name}
            value={value ?? ''}
            onChange={(event) => onChange(name, event.target.value)}
            aria-invalid={Boolean(fieldError)}
            aria-describedby={fieldError ? `${inputId}-error` : undefined}
            disabled={readOnly}
            required={required}
            className="retail-select-control"
            {...inputProps}
          >
            <option value="">{placeholder || 'Select'}</option>
            {options.map((option) => {
              const optVal = typeof option === 'object' ? option.value : option;
              const optLabel = typeof option === 'object' ? option.label : option;
              return (
                <option value={optVal} key={optVal}>{optLabel}</option>
              );
            })}
          </select>
          <span className="retail-select-chevron" aria-hidden="true">
            <ChevronDown size={15} />
          </span>
        </div>
      ) : (
        type === 'date' ? (
          <LeadDatePicker
            id={inputId}
            name={name}
            label={label}
            popupPlacement="side"
            value={value ?? ''}
            onChange={(nextValue) => handleInputChange(nextValue)}
            min={inputProps.min}
            max={inputProps.max}
            disabled={readOnly}
            required={required}
            invalid={Boolean(fieldError)}
          />
        ) : (
          <input
            {...inputProps}
            id={inputId}
            name={name}
            type={type}
            value={value ?? ''}
            onChange={(event) => handleInputChange(event.target.value)}
            onKeyDown={type === 'number' ? (event) => {
              if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault();
              inputProps.onKeyDown?.(event);
            } : inputProps.onKeyDown}
            aria-invalid={Boolean(fieldError)}
            aria-describedby={fieldError ? `${inputId}-error` : undefined}
            readOnly={readOnly}
            required={required}
            placeholder={placeholder}
            className="retail-input-control"
          />
        )
      )}
      {fieldError && (
        <span className="retail-field-error-text" id={`${inputId}-error`} role="alert">
          {fieldError}
        </span>
      )}
    </div>
  );
}

export function getRepaymentRows(form) {
  const amount = Number(form.loanAmount);
  const tenure = Number(form.tenureMonths);
  const totalRate = String(form.totalInterestRate ?? '').trim()
    ? form.totalInterestRate
    : calculateTotalInterestRate(form.interestRate, form.offsetRate);
  const annualRate = Number(totalRate);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(tenure) || tenure <= 0) {
    return [];
  }

  const monthlyRate = Number.isFinite(annualRate) && annualRate > 0
    ? annualRate / 1200
    : 0;
  const instalment = Number(calculateInstalmentAmount(amount, tenure, totalRate));
  if (!Number.isFinite(instalment) || instalment <= 0) return [];
  const start = form.instalmentStartDate ? new Date(`${form.instalmentStartDate}T00:00:00`) : null;
  const roundToCents = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
  let balance = roundToCents(amount);

  return Array.from({ length: tenure }, (_, index) => {
    const interest = roundToCents(balance * monthlyRate);
    const principal = index === tenure - 1
      ? balance
      : Math.min(balance, Math.max(0, roundToCents(instalment - interest)));
    const currentBalance = roundToCents(Math.max(0, balance - principal));
    const dateValue = start ? addMonthsToDate(form.instalmentStartDate, index) : '';
    const date = dateValue ? new Date(`${dateValue}T00:00:00`) : null;
    balance = currentBalance;
    return {
      month: date
        ? date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
        : index + 1,
      instalment: roundToCents(principal + interest),
      interest,
      principal,
      balance: currentBalance,
    };
  });
}

function formatRupees(value) {
  return Number.isFinite(value)
    ? value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
}

export default function RetailLoanApplicationForm({
  application,
  onBack,
  onCreate,
  onSave,
  backLabel = 'Loan Dashboard',
}) {
  const isEditMode = Boolean(application);
  const [form, setForm] = useState(() => createInitialRetailLoanForm(application));
  const [currentStep, setCurrentStep] = useState(0);
  const [currentPartyIndex, setCurrentPartyIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [basicLookupOptions, setBasicLookupOptions] = useState({});
  const [basicLookupNotice, setBasicLookupNotice] = useState('');
  const [basicLookupsLoading, setBasicLookupsLoading] = useState(true);
  const [repaymentPage, setRepaymentPage] = useState(0);
  const submissionLock = useRef(false);
  const repaymentRows = useMemo(() => getRepaymentRows(form), [form]);
  const repaymentPageCount = Math.ceil(repaymentRows.length / REPAYMENT_PAGE_SIZE);
  const repaymentPageIndex = Math.min(repaymentPage, Math.max(0, repaymentPageCount - 1));
  const repaymentPageStart = repaymentPageIndex * REPAYMENT_PAGE_SIZE;
  const visibleRepaymentRows = repaymentRows.slice(
    repaymentPageStart,
    repaymentPageStart + REPAYMENT_PAGE_SIZE,
  );
  const currentRelatedParty = form.relatedParties[currentPartyIndex];
  const canAddRelatedParty = Boolean(
    currentRelatedParty && Object.keys(validateRelatedParty(currentRelatedParty, currentPartyIndex)).length === 0,
  );

  useEffect(() => {
    setRepaymentPage(0);
  }, [
    form.loanAmount,
    form.tenureMonths,
    form.interestRate,
    form.offsetRate,
    form.instalmentAmount,
    form.instalmentStartDate,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBasicDetailsLookups() {
      setBasicLookupsLoading(true);
      setBasicLookupNotice('');
      const getTemporaryOptions = (field) => TEMPORARY_BASIC_DETAILS_OPTIONS[field]
        .map((value) => ({ value, label: value }));
      try {
        const lookupTypes = (await getLookupTypes(controller.signal))
          .filter((lookup) => lookup.status === 'Active');
        const entries = await Promise.all(Object.entries(BASIC_DETAILS_LOOKUPS).map(async ([field, config]) => {
          const matchRank = (lookup) => Math.min(...config.aliases.map((alias, index) => (
            [lookup.code, lookup.name].some((value) => normalizeLookupName(value) === alias)
              ? index
              : Number.POSITIVE_INFINITY
          )));
          const extendedMatchRank = (lookup) => {
            const exactMatchRank = matchRank(lookup);
            if (Number.isFinite(exactMatchRank)) return exactMatchRank;
            if (field !== 'termCode') return Number.POSITIVE_INFINITY;
            const lookupNames = [lookup.code, lookup.name].map((value) => String(value || ''));
            return lookupNames.some((value) => (
              /(^|[^a-z])(term|tenure)([^a-z]|$)/i.test(value)
              && !/(unit|duration|frequency|months?|years?|days?)/i.test(value)
            ))
              ? config.aliases.length
              : Number.POSITIVE_INFINITY;
          };
          const candidates = lookupTypes
            .filter((lookup) => lookup.code && Number.isFinite(extendedMatchRank(lookup)))
            .sort((first, second) => extendedMatchRank(first) - extendedMatchRank(second));

          if (!candidates.length) {
            return {
              field,
              options: getTemporaryOptions(field),
              error: new Error(`No active lookup type found for ${config.label}.`),
              logError: false,
            };
          }

          try {
            const options = await getLookupOptions(candidates[0].code, controller.signal);
            const activeOptions = options.filter((option) => option.status === 'Active');
            if (!activeOptions.length) {
              return {
                field,
                options: getTemporaryOptions(field),
                error: new Error(`The active ${config.label} lookup has no options.`),
                logError: false,
              };
            }
            return {
              field,
              options: activeOptions.map((option) => ({
                value: config.useCodeValue && option.code ? option.code : option.name || option.code,
                label: option.name || option.code,
              })),
            };
          } catch (error) {
            return { field, options: getTemporaryOptions(field), error, logError: true };
          }
        }));

        if (!controller.signal.aborted) {
          setBasicLookupOptions(Object.fromEntries(entries.map(({ field, options }) => [field, options])));
          const failedEntries = entries.filter((entry) => entry.error);
          if (failedEntries.length) {
            failedEntries.forEach(({ field, error, logError }) => {
              if (logError) {
                console.warn(`Using temporary options for ${BASIC_DETAILS_LOOKUPS[field].label}.`, error);
              }
            });
            setBasicLookupNotice(`Temporary frontend options are in use for ${failedEntries
              .map(({ field }) => BASIC_DETAILS_LOOKUPS[field].label)
              .join(', ')} because active lookup data is unavailable.`);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('Using temporary frontend options because Basic Details lookup data could not be loaded.', error);
          setBasicLookupOptions(Object.fromEntries(
            Object.keys(TEMPORARY_BASIC_DETAILS_OPTIONS)
              .map((field) => [field, getTemporaryOptions(field)]),
          ));
          setBasicLookupNotice('Temporary frontend options are in use because Basic Details lookup data is unavailable.');
        }
      } finally {
        if (!controller.signal.aborted) setBasicLookupsLoading(false);
      }
    }

    loadBasicDetailsLookups();
    return () => controller.abort();
  }, []);

  const getBasicDetailsLookupOptions = (field) => {
    const options = basicLookupOptions[field] || [];
    const currentValue = String(form[field] ?? '');
    if (!currentValue || options.some((option) => option.value === currentValue)) return options;
    return [{ value: currentValue, label: currentValue }, ...options];
  };

  const updateField = (name, value) => {
    const nextForm = { ...form, [name]: value };
    const changedFields = new Set([name]);
    if (name === 'interestRate' || name === 'offsetRate') {
      nextForm.totalInterestRate = calculateTotalInterestRate(
        name === 'interestRate' ? value : form.interestRate,
        name === 'offsetRate' ? value : form.offsetRate,
      );
      changedFields.add('totalInterestRate');
    }
    if (['loanAmount', 'tenureMonths', 'interestRate', 'offsetRate'].includes(name)) {
      nextForm.instalmentAmount = calculateInstalmentAmount(
        nextForm.loanAmount,
        nextForm.tenureMonths,
        nextForm.totalInterestRate,
      );
      changedFields.add('instalmentAmount');
    }
    if (name === 'tenureMonths' || name === 'instalmentStartDate') {
      nextForm.instalmentEndDate = calculateInstalmentEndDate(
        nextForm.instalmentStartDate,
        nextForm.tenureMonths,
      );
      changedFields.add('instalmentEndDate');
    }
    if (name === 'securityAmount') {
      nextForm.securityValue = getSynchronizedSecurityValue(value);
      changedFields.add('securityValue');
    }

    const dependentFields = {
      effectiveDate: ['lastTransactionDate', 'sanctionedDate', 'securityEffectiveDate'],
      lastTransactionDate: ['effectiveDate'],
      sanctionedDate: ['effectiveDate', 'expiryDate', 'instalmentStartDate', 'instalmentEndDate'],
      expiryDate: ['sanctionedDate', 'instalmentStartDate', 'instalmentEndDate'],
      instalmentStartDate: ['sanctionedDate', 'expiryDate', 'instalmentEndDate'],
      instalmentEndDate: ['instalmentStartDate', 'expiryDate'],
      securityEffectiveDate: ['effectiveDate', 'valuationDate', 'inspectionDate'],
      valuationDate: ['securityEffectiveDate'],
      inspectionDate: ['securityEffectiveDate'],
      insuranceIssueDate: ['insuranceExpiryDate'],
      insuranceExpiryDate: ['insuranceIssueDate'],
    };
    (dependentFields[name] || []).forEach((field) => changedFields.add(field));

    setForm(nextForm);
    setDirty(true);
    setSaveMessage('');
    setErrors((current) => {
      const currentStepErrors = RETAIL_STEPS.reduce(
        (allErrors, _, index) => ({ ...allErrors, ...validateStep(index, nextForm) }),
        {},
      );
      const fieldsToRefresh = new Set([...changedFields, ...Object.keys(current)]);
      const next = { ...current };
      fieldsToRefresh.forEach((field) => {
        if (currentStepErrors[field]) next[field] = currentStepErrors[field];
        else delete next[field];
      });
      return next;
    });
  };

  const updateDisbursementField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setDirty(true);
    setSaveMessage('');
    setErrors((current) => {
      const error = validateDisbursementField(form, name, value);
      if (error) return { ...current, [name]: error };
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const blurDisbursementField = (name) => {
    setErrors((current) => {
      const error = validateDisbursementField(form, name);
      if (error) return { ...current, [name]: error };
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const updateRelatedParty = (index, field, value) => {
    const inputPattern = field === 'customerNo'
      ? CODE_INPUT_PATTERN
      : ['firstName', 'middleName', 'lastName'].includes(field)
        ? NAME_INPUT_PATTERN
        : null;
    if (inputPattern && !inputPattern.test(value)) {
      setErrors((current) => ({
        ...current,
        [`relatedParties.${index}.${field}`]: field === 'customerNo'
          ? 'Use letters, numbers, hyphens, and underscores only.'
          : 'Use letters, spaces, apostrophes, or hyphens only.',
      }));
      return;
    }
    const nextParty = { ...form.relatedParties[index], [field]: value };
    const nextForm = {
      ...form,
      relatedParties: form.relatedParties.map((party, row) => row === index ? nextParty : party),
    };
    setForm(nextForm);
    setDirty(true);
    setErrors((current) => {
      const next = { ...current };
      const partyErrors = validateRelatedParty(nextParty, index);
      const key = `relatedParties.${index}.${field}`;
      if (partyErrors[key]) next[key] = partyErrors[key];
      else delete next[key];
      return next;
    });
  };

  const blurRelatedPartyField = (index, field) => {
    const partyErrors = validateRelatedParty(form.relatedParties[index], index);
    const key = `relatedParties.${index}.${field}`;
    setErrors((current) => {
      if (partyErrors[key]) return { ...current, [key]: partyErrors[key] };
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const validateStep = (step, values = form) => {
    const next = {};
    const putError = (field, error) => {
      if (error) next[field] = error;
    };
    const validateWholeNumber = (field, label, { required = false, min = 0, max = 600 } = {}) => {
      const text = String(values[field] ?? '').trim();
      if (!text) {
        if (required) next[field] = `${label} is required.`;
        return;
      }
      const number = Number(text);
      if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number < min || number > max) {
        next[field] = `${label} must be a whole number between ${min} and ${max}.`;
      }
    };

    if (step === 0) {
      putError('loanAccountNumber', validateCode(values.loanAccountNumber, 'Loan account number', { required: true }));
      putError('effectiveDate', validateDate(values.effectiveDate, 'Effective date', true));
      if (!String(values.customerId ?? '').trim()) next.customerId = 'Customer ID is required.';
      if (!['Mr', 'Mrs', 'Ms', 'Dr', 'Other'].includes(values.title)) next.title = 'Select a valid title.';
      putError('firstName', validateText(values.firstName, 'First name', { required: true, pattern: NAME_PATTERN }));
      putError('middleName', validateText(values.middleName, 'Middle name', { pattern: NAME_PATTERN }));
      putError('lastName', validateText(values.lastName, 'Last name', { required: true, pattern: NAME_PATTERN }));
      putError('productCode', validateCode(values.productCode, 'Product code', { required: true }));
      putError('productName', validateText(values.productName, 'Product description', { required: true }));
      putError('branch', validateText(values.branch, 'Branch', { minLength: 2, maxLength: 50 }));
      if (!ACCOUNT_STATUS_OPTIONS.includes(values.accountStatus)) next.accountStatus = 'Select a valid account status.';
      if (!MODE_OF_OPERATION_OPTIONS.includes(values.modeOfOperation)) next.modeOfOperation = 'Select a valid mode of operation.';
      putError('lastTransactionDate', validateDate(values.lastTransactionDate, 'Last transaction date', true));
      if (isValidDate(values.effectiveDate) && isValidDate(values.lastTransactionDate)
        && values.lastTransactionDate < values.effectiveDate) {
        next.lastTransactionDate = 'Last transaction date cannot precede the effective date.';
      }
    }

    if (step === 1) {
      values.relatedParties.forEach((party, index) => {
        Object.assign(next, validateRelatedParty(party, index));
      });
    }

    if (step === 2 || step === 3) {
      putError('sanctionedDate', validateDate(values.sanctionedDate, 'Sanction date', true));
      putError('sanctioningAuthority', validateText(values.sanctioningAuthority, 'Sanction authority', {
        required: true,
        maxLength: 50,
        pattern: NAME_PATTERN,
      }));
      putError('loanAmount', validateAmount(values.loanAmount, 'Loan amount', true));
      validateWholeNumber('tenureMonths', 'Tenure', { required: true, min: 1 });
      putError('interestRate', validateRate(values.interestRate, 'Interest rate', true));
      putError('offsetRate', validateRate(values.offsetRate, 'Offset rate'));
      putError('totalInterestRate', values.totalInterestRate
        ? validateRate(values.totalInterestRate, 'Total interest rate', true)
        : '');
      validateWholeNumber('moratorium', 'Moratorium', { min: 0 });
      putError('expiryDate', validateDate(values.expiryDate, 'Expiry date', true));
      putError('instalmentAmount', validateAmount(values.instalmentAmount, 'Instalment amount', true));
      putError('instalmentStartDate', validateDate(values.instalmentStartDate, 'Instalment start date', true));
      if (!['Monthly', 'Quarterly', 'User Defined'].includes(values.emiType)) {
        next.emiType = 'Select a valid EMI frequency.';
      }
      putError('bulletPayment', validateAmount(values.bulletPayment, 'Bullet payment'));
      putError('instalmentEndDate', validateDate(values.instalmentEndDate, 'Instalment end date', true));
      if (isValidDate(values.effectiveDate) && isValidDate(values.sanctionedDate)
        && values.sanctionedDate < values.effectiveDate) {
        next.sanctionedDate = 'Sanction date cannot precede the effective date.';
      }
      if (isValidDate(values.sanctionedDate) && isValidDate(values.expiryDate)
        && values.expiryDate <= values.sanctionedDate) {
        next.expiryDate = 'Expiry date must be after the sanction date.';
      }
      if (isValidDate(values.sanctionedDate) && isValidDate(values.instalmentStartDate)
        && values.instalmentStartDate < values.sanctionedDate) {
        next.instalmentStartDate = 'Instalment start date cannot precede the sanction date.';
      }
      if (isValidDate(values.expiryDate) && isValidDate(values.instalmentStartDate)
        && values.instalmentStartDate > values.expiryDate) {
        next.instalmentStartDate = 'Instalment start date cannot be after the expiry date.';
      }
      if (isValidDate(values.instalmentStartDate) && isValidDate(values.instalmentEndDate)
        && values.instalmentEndDate < values.instalmentStartDate) {
        next.instalmentEndDate = 'Instalment end date cannot precede the start date.';
      }
    }

    if (step === 4) {
      Object.entries(BASIC_DETAILS_LOOKUPS).forEach(([field, config]) => {
        if (!String(values[field] ?? '').trim()) next[field] = `${config.label} is required.`;
      });
    }

    if (step === 5) {
      putError('securityId', validateCode(values.securityId, 'Security ID', { required: true }));
      putError('securityType', validateText(values.securityType, 'Security type', { required: true }));
      putError('securityEffectiveDate', validateDate(values.securityEffectiveDate, 'Security effective date', true));
      putError('assetType', validateText(values.assetType, 'Asset type', { required: true }));
      putError('securityAmount', validateAmount(values.securityAmount, 'Security amount', true));
      putError('marginPercent', validateRate(values.marginPercent, 'Margin', true));
      putError('assetAddress', validateText(values.assetAddress, 'Address', {
        required: true,
        maxLength: 125,
        pattern: ADDRESS_PATTERN,
      }));
      putError('assetAddressLine2', validateText(values.assetAddressLine2, 'Address line 2', {
        required: true,
        maxLength: 125,
        pattern: ADDRESS_PATTERN,
      }));
      putError('city', validateText(values.city, 'City', { required: true }));
      putError('state', validateText(values.state, 'State', { required: true }));
      putError('pincode', /^\d{6}$/.test(String(values.pincode ?? '').trim()) ? '' : 'Enter a 6-digit PIN code.');
      putError('valuationAmount', validateAmount(values.valuationAmount, 'Valuation amount', true));
      putError('valuerName', validateText(values.valuerName, 'Valuer name', { required: true, pattern: NAME_PATTERN }));
      putError('valuationDate', validateDate(values.valuationDate, 'Valuation date', true));
      putError('inspectionBy', validateText(values.inspectionBy, 'Inspection by', { required: true }));
      putError('inspectionDate', validateDate(values.inspectionDate, 'Inspection date', true));
      if (!String(values.inspectionReportName ?? '').trim()) {
        next.inspectionReportName = 'Inspection report is required.';
      } else if (!/\.(pdf|jpe?g|png)$/i.test(String(values.inspectionReportName).trim())) {
        next.inspectionReportName = 'Select a PDF, JPG, or PNG inspection report.';
      }
      if (isValidDate(values.effectiveDate) && isValidDate(values.securityEffectiveDate)
        && values.securityEffectiveDate < values.effectiveDate) {
        next.securityEffectiveDate = 'Security effective date cannot precede the effective date.';
      }
      if (isValidDate(values.securityEffectiveDate) && isValidDate(values.valuationDate)
        && values.valuationDate < values.securityEffectiveDate) {
        next.valuationDate = 'Valuation date cannot precede the security effective date.';
      }
      if (isValidDate(values.securityEffectiveDate) && isValidDate(values.inspectionDate)
        && values.inspectionDate < values.securityEffectiveDate) {
        next.inspectionDate = 'Inspection date cannot precede the security effective date.';
      }
    }

    if (step === 6) {
      putError('securityValue', validateAmount(values.securityValue, 'Security value', true));
      putError('premiumAmount', validateAmount(values.premiumAmount, 'Premium amount', true));
      putError('insuranceCompany', validateText(values.insuranceCompany, 'Insurance company', { required: true }));
      putError('sumAssured', validateAmount(values.sumAssured, 'Sum assured', true));
      putError('policyNumber', validatePolicyNumber(values.policyNumber));
      putError('insuranceExpiryDate', validateDate(values.insuranceExpiryDate, 'Insurance expiry date', true));
      putError('insuranceIssueDate', validateDate(values.insuranceIssueDate, 'Insurance issue date', true));
      if (isValidDate(values.insuranceIssueDate) && isValidDate(values.insuranceExpiryDate)
        && values.insuranceExpiryDate <= values.insuranceIssueDate) {
        next.insuranceExpiryDate = 'Insurance expiry date must be after the issue date.';
      }
    }

    if (step === 7) {
      [
        'disbursementMode',
        'disbursementAccountNumber',
        'ifscCode',
        'bankName',
        'beneficiaryAccountName',
        'beneficiaryMobileNumber',
        'disbursementAmount',
      ].forEach((field) => {
        const error = validateDisbursementField(values, field);
        if (error) next[field] = error;
      });
      putError('remarks', validateText(values.remarks, 'Remarks', {
        minLength: 1,
        maxLength: 250,
        pattern: REMARKS_PATTERN,
      }));
    }

    return next;
  };

  const navigateToStep = (target) => {
    if (target <= currentStep) {
      setCurrentStep(target);
      return;
    }
    for (let step = currentStep; step < target; step += 1) {
      const nextErrors = validateStep(step);
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        setCurrentStep(step);
        return;
      }
    }
    setErrors({});
    setCurrentStep(target);
  };

  const blurField = (name) => {
    const allErrors = RETAIL_STEPS.reduce(
      (combined, _, index) => ({ ...combined, ...validateStep(index) }),
      {},
    );
    setErrors((current) => {
      if (allErrors[name]) return { ...current, [name]: allErrors[name] };
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const cancel = () => {
    if (dirty && !window.confirm(`Return to the ${backLabel} and discard unsaved changes?`)) return;
    onBack?.();
  };

  const submit = (event) => {
    event.preventDefault();
    if (isSubmitting || submissionLock.current) return;
    const nextErrors = RETAIL_STEPS.reduce(
      (allErrors, _, index) => ({ ...allErrors, ...validateStep(index) }),
      {},
    );
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const firstInvalidStep = RETAIL_STEPS.findIndex((_, index) => (
        Object.keys(validateStep(index)).length > 0
      ));
      setCurrentStep(firstInvalidStep < 0 ? 0 : firstInvalidStep);
      return;
    }

    const normalizedForm = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        key === 'relatedParties'
          ? value.map((party) => Object.fromEntries(
            Object.entries(party).map(([partyKey, partyValue]) => [
              partyKey,
              typeof partyValue === 'string' ? partyValue.trim() : partyValue,
            ]),
          ))
          : typeof value === 'string' ? value.trim() : value,
      ]),
    );
    const fullName = [normalizedForm.firstName, normalizedForm.middleName, normalizedForm.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const updatedApplication = {
      ...(application || {}),
      id: getApplicationId(application || {}) === 'Not available'
        ? `RL-${window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`
        : getApplicationId(application),
      customer: fullName,
      customerName: fullName,
      customerId: normalizedForm.customerId,
      product: normalizedForm.productName || application?.product || 'Retail Personal Loan',
      amount: normalizedForm.loanAmount,
      branch: normalizedForm.branch,
      applicationDate: application?.applicationDate || new Date().toISOString().slice(0, 10),
      status: application?.status || 'Pending',
      retailLoanForm: normalizedForm,
    };

    try {
      submissionLock.current = true;
      setIsSubmitting(true);
      if (isEditMode) onSave?.(updatedApplication);
      else onCreate?.(updatedApplication);
      setDirty(false);
      setSaveError('');
      setSaveMessage(isEditMode ? 'Changes saved successfully.' : 'Retail Loan application saved successfully.');
      setTimeout(() => {
        onBack?.();
      }, 1000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The application could not be saved.');
      setSaveMessage('');
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  };

  const clearStep = () => {
    const fieldsByStep = [
      ['loanAccountNumber', 'effectiveDate', 'customerId', 'branch', 'title', 'firstName', 'middleName', 'lastName', 'productCode', 'productName', 'schemeCode', 'schemeDescription', 'accountStatus', 'modeOfOperation', 'lastTransactionDate'],
      ['relatedParties'],
      ['sanctionedDate', 'loanAmount', 'interestRate', 'offsetRate', 'totalInterestRate', 'moratorium', 'expiryDate', 'instalmentAmount', 'instalmentStartDate', 'sanctioningAuthority', 'tenureMonths', 'emiType', 'bulletPayment', 'instalmentEndDate'],
      [],
      ['purposeCode', 'prioritySector', 'prioritySectorCode', 'industryType', 'industrySubType', 'physicallyChallenged', 'termCode'],
      ['securityId', 'securityType', 'securityEffectiveDate', 'assetType', 'securityAmount', 'marginPercent', 'assetAddress', 'assetAddressLine2', 'city', 'state', 'pincode', 'valuationAmount', 'valuerName', 'valuationDate', 'inspectionBy', 'inspectionDate', 'inspectionReportName'],
      ['policyType', 'premiumFrequency', 'policyStatus', 'autoRenew', 'insuranceCompany', 'policyNumber', 'insuranceIssueDate', 'premiumAmount', 'sumAssured', 'insuranceExpiryDate'],
      [
        'disbursementMode',
        'disbursementAccountNumber',
        'ifscCode',
        'bankName',
        'beneficiaryAccountName',
        'beneficiaryMobileNumber',
        'disbursementAmount',
        'remarks',
      ],
    ];
    setForm((current) => {
      const cleared = { ...current };
      fieldsByStep[currentStep].forEach((field) => {
        cleared[field] = field === 'relatedParties'
          ? [blankRelatedParty()]
          : '';
      });
      if (currentStep === 5) cleared.securityValue = '';
      return cleared;
    });
    if (currentStep === 1) setCurrentPartyIndex(0);
    setErrors({});
    setDirty(true);
  };

  const input = (label, name, options = {}) => {
    const [inputPattern, invalidInputMessage] = INPUT_VALIDATION[name] || [];
    return (
      <RetailField
        key={name}
        label={label}
        name={name}
        value={form[name]}
        onChange={updateField}
        onBlur={() => blurField(name)}
        error={errors[name]}
        inputPattern={inputPattern}
        invalidInputMessage={invalidInputMessage}
        {...options}
      />
    );
  };

  return (
    <AppShell title={isEditMode ? ' Retail Loan Application' : 'Retail Loan Application'}>
      <div className="retail-form-page">
        <div className="retail-page-heading">
          <PageHeader
            className="retail-page-title"
            title={isEditMode ? 'Edit Retail Loan Application' : 'Retail Loan Application'}
          />
          <button
            className="loan-form-back"
            type="button"
            onClick={cancel}
            aria-label={`Back to ${backLabel}`}
            title={`Back to ${backLabel}`}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Back</span>
          </button>
        </div>

        <Card className="loan-application-card">
          <div className="retail-form-container">
            {/* Step Navigation Bar */}
            <nav className="retail-stepper" aria-label="Retail loan application steps">
              {RETAIL_STEPS.map((step, index) => {
                const isCurrent = index === currentStep;
                const isComplete = index < currentStep;
                const StepIcon = RETAIL_STEP_ICONS[index];
                return (
                  <button
                    type="button"
                    key={step}
                    className={`retail-step-item ${isCurrent ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
                    onClick={() => navigateToStep(index)}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={`Step ${index + 1}: ${step}${isComplete ? ', completed' : ''}`}
                  >
                    <span className="retail-step-circle">
                      <StepIcon size={14} strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="retail-step-title">{step}</span>
                  </button>
                );
              })}
            </nav>

            <form className="retail-form-panel" onSubmit={submit} noValidate>
              {saveMessage && (
                <div className="retail-alert success" role="status">
                  <Check size={16} aria-hidden="true" />
                  <span>{saveMessage}</span>
                </div>
              )}
              {saveError && (
                <div className="retail-alert error" role="alert">
                  <span>{saveError}</span>
                </div>
              )}

              {/* Step 0: Borrower Details */}
              {currentStep === 0 && (
                <section className="retail-section-card retail-form-rows">
                  <div className="retail-grid four-column">
                    {input('Loan Account No', 'loanAccountNumber', { required: true, maxLength: 30, placeholder: 'e.g. RL-2026-001' })}
                    {input('Customer ID', 'customerId', { required: true, placeholder: 'Enter customer ID' })}
                    {input('Branch', 'branch', { maxLength: 50, placeholder: 'Branch code or location' })}
                    {input('Effective Date', 'effectiveDate', { type: 'date', required: true })}
                  </div>
                  <div className="retail-grid four-column">
                    {input('Title', 'title', { options: ['Mr', 'Mrs', 'Ms', 'Dr', 'Other'], required: true })}
                    {input('First Name', 'firstName', { required: true, maxLength: 50, placeholder: 'Enter first name' })}
                    {input('Middle Name', 'middleName', { maxLength: 50, placeholder: 'Enter middle name' })}
                    {input('Last Name', 'lastName', { required: true, maxLength: 50, placeholder: 'Enter last name' })}
                  </div>
                  <div className="retail-grid four-column">
                    {input('Product Code', 'productCode', { required: true, maxLength: 30 })}
                    {input('Product Description', 'productName', { required: true, maxLength: 50 })}
                    {input('Account Status', 'accountStatus', {
                      className: 'column-four',
                      options: ACCOUNT_STATUS_OPTIONS,
                      required: true,
                    })}
                  </div>
                  <div className="retail-grid four-column">
                    {input('Mode of Operation', 'modeOfOperation', {
                      options: MODE_OF_OPERATION_OPTIONS,
                      required: true,
                    })}
                    {input('Last Transaction Date', 'lastTransactionDate', { type: 'date', min: form.effectiveDate, required: true, max: getTodayDate() })}
                  </div>
                </section>
              )}

              {/* Step 1: Related Party */}
              {currentStep === 1 && (
                <section className="retail-section-card">
                  <div className="retail-section-header with-action">
                    <div>
                      <h3 className="retail-section-title">Related Party Information</h3>
                      <p className="retail-section-subtitle">Add co-applicants, guarantors, or nominees associated with this loan.</p>
                    </div>
                    <button
                      type="button"
                      className="retail-btn-secondary add-btn"
                      disabled={!canAddRelatedParty}
                      onClick={() => {
                        setForm((current) => ({
                          ...current,
                          relatedParties: [...current.relatedParties, blankRelatedParty()],
                        }));
                        setCurrentPartyIndex(form.relatedParties.length);
                        setDirty(true);
                        setErrors((current) => Object.fromEntries(
                          Object.entries(current).filter(([field]) => !field.startsWith('relatedParties.')),
                        ));
                      }}
                    >
                      <Plus size={15} aria-hidden="true" /> Add Related Party
                    </button>
                  </div>
                  <div className="retail-table-wrap">
                    <table className="retail-data-table">
                      <thead>
                        <tr>
                          <th style={{ width: 44 }}>Sr.</th>
                          <th>Name Type <span className="retail-required">*</span></th>
                          <th>Relation <span className="retail-required">*</span></th>
                          <th>Customer No <span className="retail-required">*</span></th>
                          <th>Sal <span className="retail-required">*</span></th>
                          <th>First Name <span className="retail-required">*</span></th>
                          <th>Middle Name</th>
                          <th>Last Name <span className="retail-required">*</span></th>
                          <th style={{ width: 48 }} aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {form.relatedParties.map((party, index) => index === currentPartyIndex ? (
                          <tr key={party.id || index}>
                            <td className="row-number">{index + 1}</td>
                            {[
                              ['nameType', PARTY_NAME_TYPE_OPTIONS, true],
                              ['relation', PARTY_RELATION_OPTIONS, true],
                              ['customerNo', null, true],
                              ['salutation', SALUTATION_OPTIONS, true],
                              ['firstName', null, true],
                              ['middleName', null, false],
                              ['lastName', null, true],
                            ].map(([field, options]) => (
                              <td key={field}>
                                {options ? (
                                  <div className="table-select-wrapper">
                                    <select
                                      aria-label={`${field} for related party ${index + 1}`}
                                      value={party[field] || ''}
                                      onChange={(event) => updateRelatedParty(index, field, event.target.value)}
                                      onBlur={() => blurRelatedPartyField(index, field)}
                                      aria-required={field !== 'middleName'}
                                      aria-invalid={Boolean(errors[`relatedParties.${index}.${field}`])}
                                      aria-describedby={errors[`relatedParties.${index}.${field}`]
                                        ? `related-party-${index}-${field}-error`
                                        : undefined}
                                      className="table-select"
                                    >
                                      <option value="">Select</option>
                                      {options.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                      ))}
                                    </select>
                                    <ChevronDown size={13} className="table-chevron" />
                                  </div>
                                ) : (
                                  <input
                                    aria-label={`${field} for related party ${index + 1}`}
                                    value={party[field] || ''}
                                    aria-invalid={Boolean(errors[`relatedParties.${index}.${field}`])}
                                    aria-required={field !== 'middleName'}
                                    onChange={(event) => updateRelatedParty(index, field, event.target.value)}
                                    onBlur={() => blurRelatedPartyField(index, field)}
                                    className="table-input"
                                    placeholder={field}
                                    maxLength={field === 'customerNo' ? 30 : 50}
                                    aria-describedby={errors[`relatedParties.${index}.${field}`]
                                      ? `related-party-${index}-${field}-error`
                                      : undefined}
                                  />
                                )}
                                {errors[`relatedParties.${index}.${field}`] && (
                                  <small
                                    className="retail-field-error-text"
                                    id={`related-party-${index}-${field}-error`}
                                    role="alert"
                                  >
                                    {`Enter valid ${getRelatedPartyFieldLabel(field)}.`}
                                  </small>
                                )}
                              </td>
                            ))}
                            <td>
                              <button
                                className="retail-icon-btn danger"
                                type="button"
                                onClick={() => {
                                  const remaining = form.relatedParties.filter((_, row) => row !== index);
                                  setForm({
                                    ...form,
                                    relatedParties: remaining.length ? remaining : [blankRelatedParty()],
                                  });
                                  setCurrentPartyIndex(Math.max(0, Math.min(index - 1, remaining.length - 1)));
                                  setErrors((current) => Object.fromEntries(
                                    Object.entries(current).filter(([field]) => !field.startsWith('relatedParties.')),
                                  ));
                                  setDirty(true);
                                }}
                                aria-label={`Remove related party ${index + 1}`}
                                title={`Remove related party ${index + 1}`}
                              >
                                <Trash2 size={14} aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ) : null)}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Step 2: Loan Details */}
              {currentStep === 2 && (
                <section className="retail-section-card retail-compact-details">
                  <div className="retail-section-header">
                    <h3 className="retail-section-title">Loan Details & Terms</h3>
                  </div>
                  <div className="retail-grid four-column">
                    {input('Sanction Date', 'sanctionedDate', { type: 'date', min: form.effectiveDate, required: true })}
                    {input('Sanction Authority', 'sanctioningAuthority', { required: true, maxLength: 50, placeholder: 'e.g. Branch Manager' })}
                    {input('Loan Amount (₹)', 'loanAmount', { type: 'number', min: '0', step: '0.01', required: true, placeholder: '0.00' })}
                    {input('Tenure (months)', 'tenureMonths', { type: 'number', min: '1', max: '600', step: '1', required: true, placeholder: 'e.g. 36' })}
                  </div>
                  <div className="retail-grid four-column">
                    {input('Interest Rate %', 'interestRate', { type: 'number', min: '0', max: '100', step: '0.01', required: true, placeholder: 'e.g. 10.50' })}
                    {input('Offset Rate %', 'offsetRate', { type: 'number', min: '0', max: '100', step: '0.01', placeholder: 'e.g. 0.00' })}
                    {input('Total Interest Rate %', 'totalInterestRate', { className: 'column-four', type: 'number', min: '0', max: '100', step: '0.01', required: true, readOnly: true })}
                  </div>
                  <div className="retail-grid four-column">
                    {input('Moratorium (months)', 'moratorium', { type: 'number', min: '0', max: '600', step: '1', placeholder: '0' })}
                    {input('Expiry Date', 'expiryDate', { type: 'date', min: dateAfter(form.sanctionedDate), required: true })}
                    {input('EMI Frequency', 'emiType', { options: ['Monthly', 'Quarterly', 'User Defined'], required: true })}
                    {input('Bullet Payment (₹)', 'bulletPayment', { type: 'number', min: '0', step: '0.01', placeholder: '0.00' })}
                  </div>
                  <div className="retail-grid four-column">
                    {input('Instalment Amount (₹)', 'instalmentAmount', { type: 'number', min: '0', step: '0.01', required: true, readOnly: true, placeholder: 'Calculated automatically' })}
                    {input('Instalment Start Date', 'instalmentStartDate', { type: 'date', min: form.sanctionedDate, max: form.expiryDate, required: true })}
                    {input('Instalment End Date', 'instalmentEndDate', { className: 'column-four retail-installment-end-date', type: 'text', value: formatDateText(form.instalmentEndDate), readOnly: true, required: true })}
                  </div>
                </section>
              )}

              {/* Step 3: Repayment Chart */}
              {currentStep === 3 && (
                <section className="retail-section-card">
                  <div className="retail-section-header">
                    <h3 className="retail-section-title">Repayment Chart</h3>
                  </div>
                  <div className="retail-table-wrap">
                    <table className="retail-data-table chart-table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Principal Amount (₹)</th>
                          <th>Instalment Amt (₹)</th>
                          <th>Interest (₹)</th>
                          <th>Principal (₹)</th>
                          <th>Balance Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repaymentRows.length ? visibleRepaymentRows.map((row, index) => {
                          const rowIndex = repaymentPageStart + index;
                          return (
                            <tr key={rowIndex}>
                              <td className="row-number">{row.month}</td>
                              <td>{formatRupees(rowIndex === 0 ? Number(form.loanAmount) : repaymentRows[rowIndex - 1].balance)}</td>
                              <td>{formatRupees(row.instalment)}</td>
                              <td>{formatRupees(row.interest)}</td>
                              <td>{formatRupees(row.principal)}</td>
                              <td><strong>{formatRupees(row.balance)}</strong></td>
                            </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan="6" className="table-empty-cell">
                              Enter a valid loan amount and tenure above to generate the repayment schedule.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {repaymentPageCount > 1 && (
                    <nav className="retail-repayment-pagination" aria-label="Repayment schedule pages">
                      <button
                        type="button"
                        className="retail-btn-secondary"
                        onClick={() => setRepaymentPage((page) => Math.max(0, page - 1))}
                        disabled={repaymentPageIndex === 0}
                      >
                        Previous
                      </button>
                      <span aria-live="polite">
                        Showing {repaymentPageStart + 1}-
                        {Math.min(repaymentPageStart + REPAYMENT_PAGE_SIZE, repaymentRows.length)}
                        {' '}of {repaymentRows.length}
                      </span>
                      <button
                        type="button"
                        className="retail-btn-secondary"
                        onClick={() => setRepaymentPage((page) => Math.min(repaymentPageCount - 1, page + 1))}
                        disabled={repaymentPageIndex >= repaymentPageCount - 1}
                      >
                        Next
                      </button>
                    </nav>
                  )}
                </section>
              )}

              {/* Step 4: Basic Details */}
              {currentStep === 4 && (
                <section className="retail-section-card retail-compact-details">
                  <div className="retail-section-header">
                    <h3 className="retail-section-title">Basic Details</h3>
                  </div>
                  {basicLookupNotice && <p className="retail-section-subtitle" role="status">{basicLookupNotice}</p>}
                  <div className="retail-grid four-column">
                    {input('Purpose Code', 'purposeCode', { options: getBasicDetailsLookupOptions('purposeCode'), required: true, readOnly: basicLookupsLoading || !basicLookupOptions.purposeCode?.length })}
                    {input('Priority Sector', 'prioritySector', { options: getBasicDetailsLookupOptions('prioritySector'), required: true, readOnly: basicLookupsLoading || !basicLookupOptions.prioritySector?.length })}
                    {input('Priority Code', 'prioritySectorCode', { className: 'column-four', options: getBasicDetailsLookupOptions('prioritySectorCode'), required: true, readOnly: basicLookupsLoading || !basicLookupOptions.prioritySectorCode?.length })}
                  </div>
                  <div className="retail-grid four-column">
                    {input('Industry Type', 'industryType', { options: getBasicDetailsLookupOptions('industryType'), required: true, readOnly: basicLookupsLoading || !basicLookupOptions.industryType?.length })}
                    {input('Industry Sub Type', 'industrySubType', { options: getBasicDetailsLookupOptions('industrySubType'), required: true, readOnly: basicLookupsLoading || !basicLookupOptions.industrySubType?.length })}
                    {input('Physically Challenged', 'physicallyChallenged', { options: getBasicDetailsLookupOptions('physicallyChallenged'), required: true, readOnly: basicLookupsLoading || !basicLookupOptions.physicallyChallenged?.length })}
                    {input('Term Code', 'termCode', { options: getBasicDetailsLookupOptions('termCode'), required: true, readOnly: basicLookupsLoading || !basicLookupOptions.termCode?.length })}
                  </div>
                </section>
              )}

              {/* Step 5: Security Details */}
              {currentStep === 5 && (
                <section className="retail-section-card retail-form-rows">
                  <div className="retail-grid three-equal-spread">
                    {input('Security ID', 'securityId', { required: true, maxLength: 30, placeholder: 'e.g. SEC-101' })}
                    {input('Security Type', 'securityType', {
                      options: addCurrentValueToOptions(RETAIL_LOAN_LOOKUP_OPTIONS.securityType, form.securityType),
                      required: true,
                    })}
                    {input('Effective Date', 'securityEffectiveDate', { type: 'date', min: form.effectiveDate, required: true })}
                  </div>
                  <div className="retail-grid three-equal-spread">
                    {input('Asset Type', 'assetType', {
                      options: addCurrentValueToOptions(RETAIL_LOAN_LOOKUP_OPTIONS.assetType, form.assetType),
                      required: true,
                    })}
                    {input('Security Amount (₹)', 'securityAmount', { type: 'number', min: '0', step: '0.01', required: true, placeholder: '0.00' })}
                    {input('Margin %', 'marginPercent', { type: 'number', min: '0', max: '100', step: '0.01', required: true, placeholder: 'e.g. 20' })}
                  </div>
                  <div className="retail-grid full-width-grid">
                    {input('Address', 'assetAddress', { required: true, maxLength: 125, placeholder: 'Address line 1' })}
                  </div>
                  <div className="retail-grid full-width-grid">
                    {input('Address Line 2', 'assetAddressLine2', { required: true, maxLength: 125, placeholder: 'Address line 2' })}
                  </div>
                  <div className="retail-grid three-equal-spread">
                    {input('City', 'city', {
                      options: addCurrentValueToOptions(RETAIL_LOAN_LOOKUP_OPTIONS.city, form.city),
                      required: true,
                    })}
                    {input('State', 'state', {
                      options: addCurrentValueToOptions(RETAIL_LOAN_LOOKUP_OPTIONS.state, form.state),
                      required: true,
                    })}
                    {input('Pincode', 'pincode', { required: true, inputMode: 'numeric', maxLength: 6, placeholder: '6-digit PIN' })}
                  </div>
                  <div className="retail-grid three-equal-spread">
                    {input('Valuation Amount (₹)', 'valuationAmount', { type: 'number', min: '0', step: '0.01', required: true, placeholder: '0.00' })}
                    {input('Valuer Name', 'valuerName', { required: true, maxLength: 50, placeholder: 'Certified Valuer Name' })}
                    {input('Valuation Done On', 'valuationDate', { type: 'date', min: form.securityEffectiveDate, required: true })}
                  </div>
                  <div className="retail-grid three-equal-spread">
                    {input('Inspection By', 'inspectionBy', { required: true, maxLength: 50, placeholder: 'Inspector Name or Agency' })}
                    {input('Inspection Done On', 'inspectionDate', { type: 'date', min: form.securityEffectiveDate, required: true })}
                    <div className="retail-field">
                      <label className="retail-field-label">
                        Inspection Report <span className="retail-required" aria-hidden="true"> *</span>
                      </label>
                      <label className="retail-file-picker">
                        <Upload size={16} aria-hidden="true" />
                        <span>{form.inspectionReportName || 'Click to select report document (.pdf, .jpg, .png)'}</span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="retail-hidden-file-input"
                          onChange={(event) => updateField('inspectionReportName', event.target.files?.[0]?.name || '')}
                        />
                      </label>
                      {errors.inspectionReportName && (
                        <span className="retail-field-error-text" role="alert">Enter valid Inspection Report.</span>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Step 6: Insurance Details */}
              {currentStep === 6 && (
                <section className="retail-section-card retail-form-rows">
                  <div className="retail-section-header">
                    <h3 className="retail-section-title">Insurance Policy & Coverage</h3>
                  </div>
                  <div className="retail-grid four-column">
                    {input('Policy Type', 'policyType', { options: RETAIL_LOAN_LOOKUP_OPTIONS.policyType })}
                    {input('Premium Frequency', 'premiumFrequency', { options: RETAIL_LOAN_LOOKUP_OPTIONS.premiumFrequency })}
                    {input('Policy Status', 'policyStatus', { options: RETAIL_LOAN_LOOKUP_OPTIONS.policyStatus })}
                    {input('Auto Renew', 'autoRenew', { options: RETAIL_LOAN_LOOKUP_OPTIONS.autoRenew })}
                  </div>
                  <div className="retail-grid four-column">
                    {input('Security Value (₹)', 'securityValue', { type: 'number', min: '0', step: '0.01', required: true, readOnly: true })}
                    {input('Premium Amount (₹)', 'premiumAmount', { type: 'number', min: '0', step: '0.01', required: true, placeholder: '0.00' })}
                    {input('Policy Number', 'policyNumber', { required: true, maxLength: 30, placeholder: 'Policy number' })}
                    {input('Sum Assured (₹)', 'sumAssured', { type: 'number', min: '0', step: '0.01', required: true, placeholder: '0.00' })}
                  </div>
                  <div className="retail-grid four-column">
                    {input('Insurance Company', 'insuranceCompany', {
                      className: 'span-two',
                      required: true,
                      maxLength: 50,
                      placeholder: 'Insurer name',
                    })}
                    {input('Insurance Issue Date', 'insuranceIssueDate', { type: 'date', required: true })}
                    {input('Insurance Expiry Date', 'insuranceExpiryDate', { type: 'date', min: dateAfter(form.insuranceIssueDate), required: true })}
                  </div>
                </section>
              )}

              {/* Step 7: Disbursement */}
              {currentStep === 7 && (
                <section className="retail-section-card retail-form-rows">
                  <div className="retail-section-header">
                    <h3 className="retail-section-title">Disbursement Account & Mode</h3>
                  </div>
                  <div className="retail-grid four-column">
                    {input('Payment Mode', 'disbursementMode', {
                      options: ['NEFT', 'RTGS', 'IMPS', 'Cheque'],
                      required: true,
                      onChange: updateDisbursementField,
                      onBlur: () => blurDisbursementField('disbursementMode'),
                    })}
                  </div>
                  <div className="retail-section-header beneficiary-details-heading">
                    <h3 className="retail-section-title">Beneficiary Details</h3>
                  </div>
                  <div className="retail-grid four-column">
                    {input('Account No', 'disbursementAccountNumber', {
                      placeholder: 'Bank account number',
                      inputMode: 'numeric',
                      maxLength: 18,
                      required: true,
                      onChange: updateDisbursementField,
                      onBlur: () => blurDisbursementField('disbursementAccountNumber'),
                    })}
                    {input('IFSC Code', 'ifscCode', {
                      placeholder: '11-character IFSC',
                      maxLength: 11,
                      required: true,
                      onChange: updateDisbursementField,
                      onBlur: () => blurDisbursementField('ifscCode'),
                    })}
                    {input('Bank Name', 'bankName', {
                      placeholder: 'Bank name',
                      maxLength: 50,
                      required: true,
                      onChange: updateDisbursementField,
                      onBlur: () => blurDisbursementField('bankName'),
                    })}
                    {input('Account Name', 'beneficiaryAccountName', {
                      placeholder: 'Beneficiary account name',
                      maxLength: 50,
                      required: true,
                      onChange: updateDisbursementField,
                      onBlur: () => blurDisbursementField('beneficiaryAccountName'),
                    })}
                    {input('Mobile No', 'beneficiaryMobileNumber', {
                      inputMode: 'numeric',
                      placeholder: '10-digit mobile number',
                      maxLength: 10,
                      required: true,
                      onChange: updateDisbursementField,
                      onBlur: () => blurDisbursementField('beneficiaryMobileNumber'),
                    })}
                    {input('Amount (Rs.)', 'disbursementAmount', {
                      type: 'number',
                      min: '0',
                      step: '0.01',
                      placeholder: '0.00',
                      required: true,
                      onChange: updateDisbursementField,
                      onBlur: () => blurDisbursementField('disbursementAmount'),
                    })}
                    {input('Remarks', 'remarks', { maxLength: 250, placeholder: 'Remarks' })}
                  </div>
                </section>
              )}

              {/* Bottom Navigation */}
              <div className="retail-form-actions">
                <div className="retail-actions-group">
                  <button type="button" className="retail-btn-secondary" onClick={cancel}>
                    Cancel
                  </button>
                  {currentStep > 0 && (
                    <button
                      type="button"
                      className="retail-btn-secondary"
                      onClick={() => setCurrentStep((step) => step - 1)}
                    >
                      <ChevronLeft size={16} aria-hidden="true" /> Previous
                    </button>
                  )}
                </div>

                <div className="retail-actions-group">
                  {(currentStep === 5 || currentStep === 6 || currentStep === 7) && (
                    <button type="button" className="retail-btn-secondary" onClick={clearStep}>
                      Clear
                    </button>
                  )}
                  {currentStep < RETAIL_STEPS.length - 1 ? (
                    <button
                      type="button"
                      className="retail-btn-primary"
                      onClick={() => navigateToStep(currentStep + 1)}
                    >
                      Next <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ) : (
                    <button type="submit" className="retail-btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Submit'}
                      <Check size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </Card>
      </div>

      <style jsx>{`
        .retail-form-page {
          min-width: 0;
          margin-top: -15px;
          color: #243039;
        }

        .retail-page-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        :global(.retail-page-title) {
          flex: 1;
          min-width: 0;
          margin: 0;
        }

        :global(.retail-page-title h1) {
          margin: 0;
          font-size: 23px;
          letter-spacing: -0.5px;
        }

        :global(.retail-page-title p) {
          display: none;
        }

        :global(.loan-form-back) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          gap: 5px;
          min-height: 32px;
          padding: 0 10px;
          border: 1px solid #368262;
          border-radius: 8px;
          background: #368262;
          color: #fff;
          font: inherit;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
          transition: border-color .15s ease, background .15s ease;
        }

        :global(.loan-form-back:hover) {
          border-color: #2d6e52;
          background: #2d6e52;
        }

        :global(.loan-dashboard-back) {
          width: 40px;
          height: 40px;
          border: 1px solid #dfe8e8;
          border-radius: 8px;
          background: #fff;
          color: #4a6369;
          display: grid;
          place-items: center;
          transition: border-color .15s ease, background .15s ease;
        }

        :global(.loan-dashboard-back:hover) {
          border-color: #b8d4cf;
          background: #f4faf9;
          color: #177e7a;
        }

        :global(.loan-application-card) {
          padding: 24px;
          border: 1px solid #dfe9eb;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 4px 20px rgba(18, 42, 54, 0.04);
        }

        .retail-form-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 0;
        }

        /* 1. Step Navigation: Horizontal Stepper */
        .retail-stepper {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          width: 100%;
          min-width: 0;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 2px 2px 16px;
          border-bottom: 0;
          scrollbar-width: thin;
          -webkit-overflow-scrolling: touch;
        }

        .retail-step-item {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          gap: 7px;
          padding: 7px 12px;
          border: 1px solid #d5e5dc;
          border-radius: 8px;
          background: #fff;
          color: #245c47;
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
          transition: background .15s ease, color .15s ease, border-color .15s ease;
        }

        .retail-step-item:hover {
          border-color: #c8e5d2;
          background: #e7f5ec;
          color: #245c47;
        }

        .retail-step-item.active {
          border-color: #c8e5d2;
          color: #245c47;
          background: #e7f5ec;
        }

        .retail-step-item.complete {
          color: #247b67;
        }

        .retail-step-circle {
          display: grid;
          width: 24px;
          height: 24px;
          flex: 0 0 24px;
          place-items: center;
          border: 1px solid #d7e2e3;
          border: 0;
          border-radius: 7px;
          background: #368262;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          transition: all .15s ease;
        }

        .retail-step-item.active .retail-step-circle {
          border: 0;
          background: #368262;
          color: #fff;
        }

        .retail-step-item.complete .retail-step-circle {
          border: 0;
          background: #368262;
          color: #fff;
        }

        .retail-step-title {
          line-height: 1.2;
        }

        /* 2. Form Panel */
        .retail-form-panel {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        /* Alerts */
        .retail-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.4;
        }

        .retail-alert.success {
          border: 1px solid #bfe0d0 !important;
          background: #f0faf5 !important;
          color: #246e53 !important;
        }

        .retail-alert.success :global(svg) {
          color: #246e53 !important;
        }

        .retail-alert.error {
          border: 1px solid #f3d4d4 !important;
          background: #fff5f5 !important;
          color: #b42318 !important;
        }

        .retail-alert.error :global(svg) {
          color: #b42318 !important;
        }

        /* 3. Section Cards */
        .retail-sections-stack {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .retail-section-card {
          border: 1px solid #dfe9eb;
          border-radius: 10px;
          background: #fff;
          padding: 20px 22px 18px;
          box-shadow: 0 1px 4px rgba(18, 42, 54, 0.02);
        }

        .retail-section-header {
          margin-bottom: 18px;
          padding-bottom: 10px;
          border-bottom: 1px solid #f0f4f5;
        }

        .retail-section-header.beneficiary-details-heading .retail-section-title {
          text-align: center;
        }

        .retail-section-header.with-action {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .retail-section-title {
          margin: 0;
          color: #1d3b48;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .retail-section-subtitle {
          margin: 4px 0 0;
          color: #708087;
          font-size: 12px;
        }

        /* 4. Grids */
        .retail-grid {
          display: grid;
          gap: 16px 20px;
        }

        .retail-grid.two-column {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          max-width: 920px;
        }

        .retail-grid.three-column {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .retail-grid.three-equal-spread {
          grid-template-columns: repeat(3, minmax(0, calc(25% - 15px)));
          justify-content: space-between;
        }

        .retail-grid.four-column {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .retail-grid.full-width-grid {
          grid-template-columns: minmax(0, 1fr);
        }

        .retail-grid.borrower-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .retail-compact-details > .retail-grid + .retail-grid {
          margin-top: 16px;
        }

        .retail-form-rows > .retail-grid + .retail-grid {
          margin-top: 16px;
        }

        .span-full {
          grid-column: 1 / -1;
        }

        .retail-grid.four-column > .span-two {
          grid-column: span 2;
        }

        .retail-grid.four-column > .column-four {
          grid-column: 4;
        }

        /* 5. Field Controls */
        :global(.retail-field) {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }

        :global(.retail-field-label) {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #304b59;
          font-size: 11px;
          font-weight: 600;
          line-height: 1.3;
          text-align: left;
        }

        :global(.retail-required) {
          color: #c74444;
          font-weight: 700;
        }

        :global(.retail-input-control),
        :global(.retail-select-control) {
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
          height: 40px;
          padding: 0 10px;
          border: 1px solid #d7e2e5;
          border-radius: 8px;
          background: #fff;
          color: #1b3541;
          font-family: inherit;
          font-size: 12px;
          outline: none;
          transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
        }

        .retail-compact-details :global(.retail-input-control),
        .retail-compact-details :global(.retail-select-control) {
          height: 40px;
          padding: 0 10px;
          border-color: #c6dacf;
          background: #fff;
        }

        :global(.retail-field .lead-calendar-picker .lead-date-picker-trigger) {
          box-sizing: border-box;
          height: 40px;
          min-height: 40px;
          font-family: inherit;
          font-size: 12px;
        }

        :global(.retail-installment-end-date .retail-input-control:read-only) {
          background: #fff;
          color: #1b3541;
          cursor: default;
        }

        .retail-compact-details :global(.retail-field .lead-calendar-picker .lead-date-picker-trigger) {
          border-color: #c6dacf;
          background: #fff;
        }

        :global(.retail-input-control:focus),
        :global(.retail-select-control:focus) {
          border-color: #177e7a;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(23, 126, 122, 0.12);
        }

        .retail-compact-details :global(.retail-input-control:focus),
        .retail-compact-details :global(.retail-select-control:focus) {
          border-color: #368262;
          box-shadow: none;
        }

        .retail-compact-details :global(.retail-field .lead-calendar-picker .lead-date-picker-trigger:focus) {
          border-color: #368262;
          box-shadow: none;
        }

        :global(.retail-input-control::placeholder) {
          color: #8c9ea6;
        }

        :global(.retail-field.has-error .retail-input-control),
        :global(.retail-field.has-error .retail-select-control) {
          border-color: #dc2626;
          background: #fffafb;
        }

        :global(.retail-field.has-error .retail-input-control:focus),
        :global(.retail-field.has-error .retail-select-control:focus) {
          border-color: #dc2626;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12);
        }

        :global(.retail-select-wrapper) {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }

        :global(.retail-select-control) {
          appearance: none;
          padding-right: 34px;
          cursor: pointer;
        }

        :global(.retail-select-chevron) {
          position: absolute;
          right: 12px;
          display: grid;
          place-items: center;
          color: #60747a;
          pointer-events: none;
        }

        :global(.retail-field-error-text) {
          display: block;
          color: #b42318;
          font-size: 11px;
          font-weight: 500;
          line-height: 1.35;
          margin-top: 2px;
        }

        /* File Upload Picker */
        .retail-file-picker {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 40px;
          padding: 0 14px;
          border: 1px dashed #c0d3d8;
          border-radius: 8px;
          background: #f8fbfc;
          color: #35535d;
          font-size: 13px;
          cursor: pointer;
          transition: border-color .15s ease, background .15s ease;
        }

        .retail-file-picker:hover {
          border-color: #177e7a;
          background: #f2f8f7;
          color: #177e7a;
        }

        .retail-hidden-file-input {
          display: none;
        }

        /* 6. Tables (Related Party & Repayment Chart) */
        .retail-table-wrap {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #dfe8eb;
          border-radius: 8px;
          background: #fff;
        }

        .retail-data-table {
          width: 100%;
          min-width: 860px;
          border-collapse: collapse;
          font-size: 12px;
          color: #2e4652;
          text-align: left;
        }

        .retail-data-table th {
          background: #f4f8f9;
          color: #435e67;
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .04em;
          padding: 10px 12px;
          border-bottom: 1px solid #dfe8eb;
          white-space: nowrap;
        }

        .retail-data-table td {
          padding: 8px 10px;
          border-bottom: 1px solid #edf2f3;
          vertical-align: middle;
        }

        .retail-data-table.chart-table th,
        .retail-data-table.chart-table td {
          text-align: center;
        }

        .retail-data-table tbody tr:last-child td {
          border-bottom: none;
        }

        .retail-data-table tbody tr:hover {
          background: #fafcfd;
        }

        .retail-repayment-pagination {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 14px;
          color: #708087;
          font-size: 12px;
        }

        .retail-repayment-pagination .retail-btn-secondary {
          min-height: 34px;
          padding: 0 12px;
        }

        .retail-repayment-pagination .retail-btn-secondary:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .row-number {
          color: #708087;
          font-weight: 600;
          text-align: center;
        }

        .table-select-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          min-width: 110px;
        }

        .table-select {
          box-sizing: border-box;
          width: 100%;
          height: 40px;
          padding: 0 24px 0 8px;
          border: 1px solid #d7e2e5;
          border-radius: 6px;
          background: #f8fbfc;
          color: #1b3541;
          font-family: inherit;
          font-size: 13px;
          appearance: none;
          outline: none;
        }

        .table-select:focus {
          border-color: #177e7a;
          background: #fff;
        }

        :global(.table-chevron) {
          position: absolute;
          right: 8px;
          color: #60747a;
          pointer-events: none;
        }

        .table-input {
          box-sizing: border-box;
          width: 100%;
          min-width: 90px;
          height: 40px;
          padding: 0 8px;
          border: 1px solid #d7e2e5;
          border-radius: 6px;
          background: #f8fbfc;
          color: #1b3541;
          font-family: inherit;
          font-size: 13px;
          outline: none;
        }

        .table-input:focus {
          border-color: #177e7a;
          background: #fff;
        }

        .retail-icon-btn {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border: 1px solid transparent;
          border-radius: 6px;
          background: transparent;
          cursor: pointer;
          transition: background .15s ease, color .15s ease;
        }

        .retail-icon-btn.danger {
          color: #8c4a4a;
        }

        .retail-icon-btn.danger:hover {
          border-color: #f3d4d4;
          background: #fff4f4;
          color: #c72d2d;
        }

        .table-empty-cell {
          padding: 30px 16px !important;
          text-align: center;
          color: #708087;
          font-size: 13px;
        }

        /* 7. Bottom Navigation Buttons */
        .retail-form-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 28px;
          padding-top: 20px;
          border-top: 1px solid #edf1f3;
        }

        .retail-actions-group {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
        }

        .retail-btn-secondary,
        .retail-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          min-width: 110px;
          padding: 0 18px;
          border-radius: 8px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: transform .15s ease, box-shadow .15s ease, background .15s ease, border-color .15s ease;
        }

        .retail-btn-secondary {
          border: 1px solid #dce5e8;
          background: #ffffff;
          color: #224c5f;
        }

        .retail-btn-secondary:hover {
          border-color: #cbd8dc;
          background: #f5f8f9;
          transform: translateY(-1px);
        }

        .retail-btn-secondary.add-btn {
          min-height: 36px;
          font-size: 12px;
          padding: 0 14px;
        }

        .retail-btn-primary {
          border: 1px solid #368262;
          background: #368262;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(54, 130, 98, 0.22);
        }

        .retail-btn-primary:hover {
          background: #2d6e52;
          border-color: #2d6e52;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(54, 130, 98, 0.28);
        }

        .retail-btn-primary:disabled {
          opacity: 0.65;
          cursor: wait;
          transform: none;
          box-shadow: none;
        }

        .retail-step-item:focus-visible,
        .retail-btn-secondary:focus-visible,
        .retail-btn-primary:focus-visible,
        :global(.loan-form-back:focus-visible),
        :global(.loan-dashboard-back:focus-visible) {
          outline: 3px solid rgba(23, 126, 122, 0.35);
          outline-offset: 2px;
        }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .retail-grid.borrower-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
          }
        }

        @media (max-width: 820px) {
          :global(.loan-application-card) {
            padding: 18px;
          }

          .retail-grid.three-column {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .retail-grid.three-equal-spread {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            justify-content: initial;
          }

          .retail-grid.four-column,
          .retail-grid.borrower-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .retail-grid.four-column > .column-four {
            grid-column: auto;
          }

          .retail-stepper {
            gap: 6px;
            padding-bottom: 12px;
          }

          .retail-step-item {
            padding: 6px 10px;
            font-size: 11px;
          }

          .retail-step-circle {
            width: 24px;
            height: 24px;
            flex-basis: 24px;
            font-size: 10px;
          }

          .retail-section-header.with-action {
            flex-direction: column;
            align-items: stretch;
          }

          .retail-section-header.with-action .retail-btn-secondary {
            align-self: flex-start;
          }
        }

        @media (max-width: 540px) {
          :global(.loan-application-card) {
            padding: 14px 12px;
          }

          .retail-repayment-pagination {
            justify-content: center;
            flex-wrap: wrap;
          }

          .retail-section-card {
            padding: 14px 14px 12px;
          }

          .retail-grid.borrower-grid {
            grid-template-columns: 1fr;
          }

          .retail-grid.four-column {
            grid-template-columns: 1fr;
          }

          .retail-grid.four-column > .span-two {
            grid-column: 1 / -1;
          }

          .retail-grid.two-column,
          .retail-grid.three-column,
          .retail-grid.three-equal-spread {
            grid-template-columns: 1fr;
            max-width: none;
          }

          .retail-form-actions {
            flex-direction: column-reverse;
            align-items: stretch;
            gap: 12px;
          }

          .retail-actions-group {
            width: 100%;
            justify-content: space-between;
          }

          .retail-actions-group .retail-btn-secondary,
          .retail-actions-group .retail-btn-primary {
            flex: 1;
            min-width: 0;
          }

          .retail-page-heading {
            align-items: flex-start;
          }

          :global(.retail-page-title h1) {
            font-size: 20px;
          }
        }
      `}</style>
    </AppShell>
  );
}
