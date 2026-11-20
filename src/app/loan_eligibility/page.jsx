'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CirclePlus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import AppShell from '../../components/AppShell';
import { persistRetailLoanApplication } from '../../components/RetailLoanApplicationForm';
import { assessLoanEligibility } from '../../services/loanEligibility';
import { getLeads } from '../../services/localLeads';

const POLICY = {
  maxFoir: 50,
  reviewFoir: 40,
  cibilFloor: 650,
  maxHomeLtv: {
    upTo30L: 90,
    upTo75L: 80,
    above75L: 75
  }
};

const LOAN_PRODUCTS = [
  'Personal loan',
  'Home loan',
  'Vehicle loan',
  'Business loan',
  'Gold loan',
  'Other secured loan'
];

const MAX_FINANCIAL_ROWS = 10;

export function isSecuredProduct(productName) {
  return /home|vehicle|gold|secured/i.test(productName);
}

const makeRow = (id, type = 'Income') => ({
  id,
  type,
  source: '',
  amount: ''
});

const initialForm = () => ({
  leadId: '',
  applicantName: '',
  productName: '',
  requestedAmount: '',
  annualInterestRate: '',
  securityValue: '',
  tenureMonths: '',
  cibilScore: '',
  existingMonthlyDebt: '0',
  rows: [makeRow(1, 'Income')]
});

const numberValue = value => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const leadValue = (lead, ...fields) => {
  for (const field of fields) {
    const value = lead?.[field];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
};

function getLeadName(lead) {
  const personNameParts = [
    leadValue(lead, 'firstName', 'first_name'),
    leadValue(lead, 'middleName', 'middle_name'),
    leadValue(lead, 'lastName', 'last_name')
  ].filter(Boolean);
  const prefix = leadValue(lead, 'namePrefix', 'name_prefix', 'title');
  return personNameParts.length
    ? [prefix, ...personNameParts].filter(Boolean).join(' ')
    : String(leadValue(lead, 'customerName', 'customer_name', 'name', 'applicantName', 'applicant_name') || '');
}

function getLeadId(lead) {
  return String(leadValue(lead, 'leadId', 'lead_id', 'id', '_id'));
}

function getLeadProduct(lead) {
  const value = String(leadValue(lead, 'loanProductType', 'loan_product_type', 'product', 'productName', 'product_name') || '').trim();
  const exactMatch = LOAN_PRODUCTS.find(product => product.toLowerCase() === value.toLowerCase());
  if (exactMatch) return exactMatch;
  if (/personal/i.test(value)) return 'Personal loan';
  if (/home/i.test(value)) return 'Home loan';
  if (/vehicle|car|auto/i.test(value)) return 'Vehicle loan';
  if (/business/i.test(value)) return 'Business loan';
  if (/gold/i.test(value)) return 'Gold loan';
  if (/secured/i.test(value)) return 'Other secured loan';
  return '';
}

const money = value => (
  Number.isFinite(value)
    ? value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'
);

const percent = value => (
  Number.isFinite(value) ? `${value.toFixed(2)}%` : '—'
);

export function calculateEmi(principal, annualRate, tenureMonths) {
  if (
    !Number.isFinite(principal) ||
    !Number.isFinite(annualRate) ||
    !Number.isFinite(tenureMonths) ||
    principal <= 0 ||
    annualRate < 0 ||
    tenureMonths <= 0
  ) {
    return 0;
  }

  const monthlyRate = annualRate / 1200;
  if (monthlyRate === 0) return principal / tenureMonths;

  const factor = (1 + monthlyRate) ** tenureMonths;
  return (principal * monthlyRate * factor) / (factor - 1);
}

export function calculatePrincipal(emi, annualRate, tenureMonths) {
  if (
    !Number.isFinite(emi) ||
    !Number.isFinite(annualRate) ||
    !Number.isFinite(tenureMonths) ||
    emi <= 0 ||
    annualRate < 0 ||
    tenureMonths <= 0
  ) {
    return 0;
  }

  const monthlyRate = annualRate / 1200;
  if (monthlyRate === 0) return emi * tenureMonths;
  return (emi * (1 - (1 + monthlyRate) ** -tenureMonths)) / monthlyRate;
}

function homeLtvLimit(amount) {
  if (amount <= 3000000) return POLICY.maxHomeLtv.upTo30L;
  if (amount <= 7500000) return POLICY.maxHomeLtv.upTo75L;
  return POLICY.maxHomeLtv.above75L;
}

export function calculateAssessment(form) {
  const requestedAmount = numberValue(form.requestedAmount);
  const annualInterestRate = numberValue(form.annualInterestRate);
  const tenureMonths = numberValue(form.tenureMonths);
  const securityValue = numberValue(form.securityValue);
  const cibilScore = numberValue(form.cibilScore);
  const existingMonthlyDebt = numberValue(form.existingMonthlyDebt) || 0;
  const totalIncome = form.rows.reduce(
    (total, row) => total + (row.type === 'Income' ? numberValue(row.amount) || 0 : 0),
    0
  );
  const totalExpenses = form.rows.reduce(
    (total, row) => total + (row.type === 'Expense' ? numberValue(row.amount) || 0 : 0),
    0
  );
  const netIncome = Math.max(0, totalIncome - totalExpenses);
  const requestedEmi = requestedAmount && annualInterestRate !== null && tenureMonths
    ? calculateEmi(requestedAmount, annualInterestRate, tenureMonths)
    : 0;
  const totalMonthlyObligations = existingMonthlyDebt + requestedEmi;
  const foir = netIncome > 0
    ? (totalMonthlyObligations / netIncome) * 100
    : null;
  const dti = totalIncome > 0
    ? (totalMonthlyObligations / totalIncome) * 100
    : null;
  const ltv = securityValue > 0 && requestedAmount
    ? (requestedAmount / securityValue) * 100
    : null;

  const isHomeLoan = /home/i.test(form.productName);
  const maxAffordableEmi = Math.max(
    0,
    Math.min(
      netIncome - existingMonthlyDebt,
      (netIncome * POLICY.maxFoir) / 100 - existingMonthlyDebt
    )
  );
  const affordableAmount = annualInterestRate !== null && tenureMonths
    ? calculatePrincipal(maxAffordableEmi, annualInterestRate, tenureMonths)
    : 0;
  const ltvLimit = isHomeLoan && requestedAmount
    ? homeLtvLimit(requestedAmount)
    : null;
  const securityLimitAmount = ltvLimit !== null && securityValue
    ? (securityValue * ltvLimit) / 100
    : Infinity;
  const eligibleAmount = requestedAmount !== null
    ? Math.max(0, Math.min(requestedAmount, affordableAmount, securityLimitAmount))
    : 0;
  const eligibleEmi = eligibleAmount > 0 && annualInterestRate !== null && tenureMonths
    ? calculateEmi(eligibleAmount, annualInterestRate, tenureMonths)
    : 0;

  return {
    totalIncome,
    totalExpenses,
    netIncome,
    existingMonthlyDebt,
    requestedEmi,
    totalMonthlyObligations,
    foir,
    dti,
    ltv,
    ltvLimit,
    eligibleAmount,
    eligibleEmi,
    cibilScore
  };
}

export function validate(form) {
  const errors = {};

  const requiredFields = [
    ['leadId', 'Lead ID is required.'],
    ['applicantName', 'Applicant name is required.'],
    ['productName', 'Loan product is required.'],
    ['requestedAmount', 'Loan amount is required.'],
    ['annualInterestRate', 'Interest rate is required.'],
    ['tenureMonths', 'Tenure is required.'],
    ['cibilScore', 'CIBIL score is required.'],
    ['existingMonthlyDebt', 'Enter existing monthly debt, or 0 if you have none.']
  ];
  requiredFields.forEach(([field, message]) => {
    if (!String(form[field] ?? '').trim()) errors[field] = message;
  });

  const rows = Array.isArray(form.rows) ? form.rows : [];
  if (!rows.some(row => row.type === 'Income')) errors.income = 'Add at least one income entry.';
  rows.forEach(row => {
    const source = String(row.source ?? '').trim();
    const amount = String(row.amount ?? '').trim();
    if (!String(row.type ?? '').trim()) errors[`row-${row.id}-type`] = 'Entry type is required.';
    if (!source) errors[`row-${row.id}-source`] = 'Source is required.';
    if (!amount) errors[`row-${row.id}-amount`] = 'Amount is required.';
  });

  return errors;
}

function approvalLetter(form, assessment) {
  return `Dear ${form.applicantName},

With reference to your interest in availing of ${form.productName} from us for a requested loan amount of Rs. ${money(numberValue(form.requestedAmount))}, and based on the information and details provided by you, we are pleased to inform you that your application has been assessed for preliminary eligibility.

Accordingly, an in-principle loan approval for an amount of Rs. ${money(assessment.eligibleAmount)} has been accorded, subject to verification of the documents submitted, satisfactory credit assessment, and compliance with the applicable lending policies, terms, and conditions of the Bank/Financial Institution. The rate of Interest shall be ${form.annualInterestRate}% and the EMI will be Rs. ${money(assessment.eligibleEmi)} for a tenure of ${form.tenureMonths} months.

The final loan amount, applicable interest rate, repayment tenure, EMI, and other relevant terms and conditions will be communicated to you upon completion of the required verification and approval formalities.

Please note that this communication is an intimation of in-principle approval only and does not constitute a final loan sanction or an unconditional commitment to disburse the loan.

Acceptance to Proceed

If you wish to proceed with the loan application and the subsequent disbursement process for the above-mentioned eligible loan amount of Rs. ${money(assessment.eligibleAmount)}, kindly confirm your acceptance by replying to this email.

Upon receipt of your acceptance, the application will proceed to the next stage, subject to the applicable verification and approval requirements.

The Key Facts Statement (KFS), containing the applicable details of the loan, including the loan terms, charges and fees, EMI amount, and other relevant disclosures, along with the loan sanction terms and loan agreement, as applicable, will be provided to you before final disbursement.

Should you require any further clarification or assistance, please feel free to contact us.

Thank you for your interest in our loan services. We look forward to assisting you.

Yours sincerely,
<Authorized_Signatory>
<Designation>
<Bank/Financial_Institution_Name>
<Contact_Details>`;
}

function actionFor(value, goodLimit, reviewLimit) {
  if (!Number.isFinite(value)) return 'Enter details';
  if (value <= goodLimit) return 'Within limit';
  if (value <= reviewLimit) return 'Review';
  return 'Outside limit';
}

export default function LoanEligibilityPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [assessment, setAssessment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const [leads, setLeads] = useState([]);
  const [leadSearch, setLeadSearch] = useState('');

  const securedProduct = isSecuredProduct(form.productName);
  const hasLtvLimit = Number.isFinite(assessment?.ltvLimit);
  const cibilAction = !assessment
    ? 'Pending'
    : assessment.cibilScore >= POLICY.cibilFloor ? 'Within limit' : 'Outside limit';
  const ltvAction = !assessment
    ? 'Pending'
    : !Number.isFinite(assessment.ltv)
      ? 'Optional'
    : hasLtvLimit
      ? actionFor(assessment.ltv, assessment.ltvLimit - 5, assessment.ltvLimit)
      : 'Calculated';
  const decision = assessment
    ? assessment.decision
    : 'Assessment pending';

  function openLeadPicker() {
    setLeadPickerOpen(true);
    setLeadSearch('');
    setLeads(getLeads());
  }

  function selectLead(lead) {
    const applicantName = getLeadName(lead).trim();
    const productName = getLeadProduct(lead);
    const nextValues = {
      leadId: getLeadId(lead),
      ...(applicantName ? { applicantName } : {}),
      ...(productName ? { productName } : {})
    };
    const requestedAmount = leadValue(lead, 'loanAmount', 'loan_amount', 'requestedAmount', 'requested_amount', 'amount');
    const annualInterestRate = leadValue(lead, 'annualInterestRate', 'annual_interest_rate', 'interestRate', 'interest_rate');
    let tenureMonths = leadValue(lead, 'tenureMonths', 'tenure_months', 'loanTenureMonths', 'loan_tenure_months');
    if (tenureMonths === '') {
      const tenure = Number(leadValue(lead, 'tenure'));
      const tenureUnit = String(leadValue(lead, 'tenureUnit', 'tenure_unit') || 'month').toLowerCase();
      const multiplier = /year/.test(tenureUnit) ? 12 : /quarter/.test(tenureUnit) ? 3 : 1;
      if (Number.isFinite(tenure) && tenure > 0 && Number.isInteger(tenure * multiplier)) {
        tenureMonths = String(tenure * multiplier);
      }
    }
    const securityValue = leadValue(lead, 'securityValue', 'security_value', 'collateral', 'securityAmount', 'security_amount');
    const existingMonthlyDebt = leadValue(lead, 'existingMonthlyDebt', 'existing_monthly_debt', 'monthlyEmi', 'monthly_emi');
    const cibilScore = leadValue(lead, 'cibilScore', 'cibil_score');
    const incomeSource = String(leadValue(lead, 'incomeSource', 'income_source') || '').trim();
    const monthlyIncome = leadValue(lead, 'grossMonthlyIncome', 'gross_monthly_income', 'monthlyIncome', 'monthly_income');
    const annualIncome = leadValue(lead, 'annualIncome', 'annual_income');
    const takeHomePay = leadValue(lead, 'takeHomePay', 'take_home_pay');
    const parsedMonthlyIncome = monthlyIncome !== ''
      ? Number(String(monthlyIncome).replace(/,/g, ''))
      : annualIncome !== ''
        ? Number(String(annualIncome).replace(/,/g, '')) / 12
        : Number(String(takeHomePay).replace(/,/g, ''));
    const importedIncome = Number.isFinite(parsedMonthlyIncome) && parsedMonthlyIncome > 0
      ? { source: incomeSource || 'Monthly income', amount: parsedMonthlyIncome.toFixed(2) }
      : null;

    [
      ['requestedAmount', requestedAmount],
      ['annualInterestRate', annualInterestRate],
      ['tenureMonths', tenureMonths],
      ['securityValue', securityValue],
      ['existingMonthlyDebt', existingMonthlyDebt],
      ['cibilScore', cibilScore]
    ].forEach(([field, value]) => {
      if (value !== '') nextValues[field] = String(value).replace(/,/g, '').trim();
    });

    setForm(current => {
      let rows = current.rows;
      if (importedIncome && !rows.some(row =>
        row.type === 'Income' &&
        row.source.trim().toLowerCase() === importedIncome.source.toLowerCase()
      )) {
        const emptyIncomeRow = rows.find(row =>
          row.type === 'Income' && !row.source.trim() && !row.amount.trim()
        );
        if (emptyIncomeRow) {
          rows = rows.map(row => row.id === emptyIncomeRow.id
            ? { ...row, ...importedIncome }
            : row);
        } else if (rows.length < MAX_FINANCIAL_ROWS) {
          rows = [...rows, {
            ...makeRow(Math.max(0, ...rows.map(row => row.id)) + 1),
            ...importedIncome
          }];
        }
      }
      return { ...current, ...nextValues, rows };
    });
    setErrors(current => Object.fromEntries(
      Object.entries(current).map(([field, message]) => [
        field,
        Object.prototype.hasOwnProperty.call(nextValues, field) || /^row-\d+-(source|amount|type)$/.test(field) || field === 'income'
          ? ''
          : message
      ])
    ));
    setAssessment(null);
    setFormError('');
    setLeadPickerOpen(false);
  }

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => ({
      ...current,
      [field]: '',
      ...(field === 'productName' ? { securityValue: '' } : {})
    }));
    setAssessment(null);
    setFormError('');
  }

  function updateRow(id, field, value) {
    setForm(current => ({
      ...current,
      rows: current.rows.map(row => row.id === id ? { ...row, [field]: value } : row)
    }));
    setErrors(current => {
      const sourceErrors = field === 'source' || field === 'type'
        ? Object.fromEntries(form.rows.map(row => [`row-${row.id}-source`, '']))
        : {};
      return {
        ...current,
        ...sourceErrors,
        [`row-${id}-source`]: '',
        [`row-${id}-amount`]: '',
        [`row-${id}-type`]: '',
        income: ''
      };
    });
    setAssessment(null);
    setFormError('');
  }

  function addRow() {
    setForm(current => {
      if (current.rows.length >= MAX_FINANCIAL_ROWS) return current;
      return {
        ...current,
        rows: [...current.rows, makeRow(Math.max(0, ...current.rows.map(row => row.id)) + 1)]
      };
    });
    setErrors(current => ({ ...current, rows: '' }));
    setAssessment(null);
    setFormError('');
  }

  function removeRow(id) {
    setForm(current => ({
      ...current,
      rows: current.rows.filter(row => row.id !== id)
    }));
    setErrors(current => ({
      ...current,
      ...Object.fromEntries(form.rows.map(row => [`row-${row.id}-source`, ''])),
      [`row-${id}-source`]: '',
      [`row-${id}-amount`]: '',
      rows: '',
      income: ''
    }));
    setAssessment(null);
    setFormError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setFormError('');

    if (Object.keys(nextErrors).length) {
      setAssessment(null);
      return;
    }
    if (!window.confirm('Submit this eligibility assessment for calculation?')) return;

    const result = calculateAssessment(form);
    const reasons = [];
    if (result.cibilScore < POLICY.cibilFloor) {
      reasons.push(`CIBIL score is below the indicative ${POLICY.cibilFloor} screening floor.`);
    }
    if (result.eligibleAmount <= 0) {
      reasons.push('The entered income and expenses do not support an eligible loan amount.');
    }

    const reviewReasons = [];
    if (result.foir > POLICY.reviewFoir && result.foir <= POLICY.maxFoir) {
      reviewReasons.push(`FOIR is above ${POLICY.reviewFoir}% and requires a manual review.`);
    }
    if (result.dti > POLICY.reviewFoir && result.dti <= POLICY.maxFoir) {
      reviewReasons.push(`DTI is above ${POLICY.reviewFoir}% and requires a manual review.`);
    }
    if (
      result.ltv !== null &&
      result.ltvLimit !== null &&
      result.ltv > result.ltvLimit - 5 &&
      result.ltv <= result.ltvLimit
    ) {
      reviewReasons.push('LTV is close to the indicative limit and requires a manual review.');
    }
    if (result.eligibleAmount > 0 && result.eligibleAmount < numberValue(form.requestedAmount)) {
      reviewReasons.push('The requested amount is higher than the indicative eligible amount.');
    }

    setSaving(true);
    try {
      const apiResult = await assessLoanEligibility({
        lead_id: form.leadId.trim(),
        customer_name: form.applicantName.trim(),
        product: form.productName,
        requested_amount: numberValue(form.requestedAmount),
        annual_interest_rate: numberValue(form.annualInterestRate),
        tenure_months: numberValue(form.tenureMonths),
        security_value: numberValue(form.securityValue),
        income_expenses: form.rows
          .filter(row => row.source.trim() || row.amount !== '')
          .map(row => ({
            type: row.type.toLowerCase(),
            source: row.source.trim(),
            amount: numberValue(row.amount) || 0
          })),
        cibil_score: result.cibilScore,
        calculated_metrics: {
          total_income: result.totalIncome,
          total_expense: result.totalExpenses,
          net_income: result.netIncome,
          existing_monthly_debt: result.existingMonthlyDebt,
          proposed_emi: result.requestedEmi,
          foir: result.foir,
          dti: result.dti,
          ltv: result.ltv,
          max_affordable_loan: result.eligibleAmount
        }
      });

      const remote = apiResult.configured
        ? apiResult.result?.data || apiResult.result
        : null;
      const remoteDecision = remote?.decision ?? remote?.eligible;
      const remoteEligibleAmount = numberValue(
        remote?.eligible_amount ?? remote?.eligibleAmount ?? remote?.max_eligible_amount
      );
      let finalDecision = reasons.length
        ? 'Not Eligible'
        : reviewReasons.length
          ? 'Refer for Review'
          : 'Eligible';
      let finalReasons = reasons;
      let finalEligibleAmount = result.eligibleAmount;

      if (remoteEligibleAmount !== null && remoteEligibleAmount >= 0) {
        finalEligibleAmount = remoteEligibleAmount;
      }

      const reducedAmount = finalEligibleAmount > 0 &&
        finalEligibleAmount < numberValue(form.requestedAmount);
      if (remoteDecision === false) {
        finalDecision = 'Not Eligible';
        finalReasons = [remote?.message || 'The lender assessment did not approve this application.'];
      } else if (remoteDecision === true) {
        finalDecision = finalEligibleAmount <= 0
          ? 'Not Eligible'
          : reducedAmount || reviewReasons.length
            ? 'Refer for Review'
            : 'Eligible';
        finalReasons = finalEligibleAmount <= 0
          ? ['The lender assessment returned no eligible loan amount.']
          : reviewReasons;
      } else if (typeof remoteDecision === 'string') {
        if (/not eligible|ineligible|reject|declin|outside/i.test(remoteDecision)) {
          finalDecision = 'Not Eligible';
          finalReasons = [remote?.message || 'The lender assessment did not approve this application.'];
        } else if (/refer|review|pending/i.test(remoteDecision)) {
          finalDecision = 'Refer for Review';
          finalReasons = [remote?.message || 'The lender assessment requires a manual review.'];
        } else if (/eligible|approve|accept/i.test(remoteDecision)) {
          finalDecision = finalEligibleAmount <= 0
            ? 'Not Eligible'
            : reducedAmount || reviewReasons.length
              ? 'Refer for Review'
              : 'Eligible';
          finalReasons = finalEligibleAmount <= 0
            ? ['The lender assessment returned no eligible loan amount.']
            : reviewReasons;
        } else {
          finalDecision = 'Refer for Review';
          finalReasons = [remote?.message || 'The lender returned a result that requires manual review.'];
        }
      } else if (!reasons.length) {
        finalReasons = reviewReasons;
      }

      const finalEligibleEmi = finalEligibleAmount > 0
        ? calculateEmi(
          finalEligibleAmount,
          numberValue(form.annualInterestRate),
          numberValue(form.tenureMonths)
        )
        : 0;

      setAssessment({
        ...result,
        eligibleAmount: finalEligibleAmount,
        eligibleEmi: finalEligibleEmi,
        decision: finalDecision,
        reasons: finalReasons,
        isEligible: finalDecision === 'Eligible' && finalEligibleAmount > 0
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to assess eligibility.');
      setAssessment(null);
    } finally {
      setSaving(false);
    }
  }

  function saveAndContinue() {
    if (!assessment?.isEligible || saving) return;

    try {
      const fullName = form.applicantName.trim().split(/\s+/);
      const applicationId = `ELIG-${Date.now()}`;
      const application = {
        id: applicationId,
        customer: form.applicantName.trim(),
        customerName: form.applicantName.trim(),
        leadId: form.leadId.trim(),
        product: form.productName,
        productName: form.productName,
        amount: String(assessment.eligibleAmount),
        status: 'Draft',
        applicationDate: new Date().toISOString().slice(0, 10),
        eligibilityAssessment: {
          decision: assessment.decision,
          requestedAmount: numberValue(form.requestedAmount),
          eligibleAmount: assessment.eligibleAmount,
          interestRate: numberValue(form.annualInterestRate),
          tenureMonths: numberValue(form.tenureMonths),
          emi: assessment.eligibleEmi,
          foir: assessment.foir,
          dti: assessment.dti,
          ltv: assessment.ltv,
          cibilScore: assessment.cibilScore
        },
        retailLoanForm: {
          firstName: fullName[0] || '',
          middleName: fullName.length > 2 ? fullName.slice(1, -1).join(' ') : '',
          lastName: fullName.length > 1 ? fullName[fullName.length - 1] : '',
          productName: form.productName,
          loanAmount: String(assessment.eligibleAmount),
          interestRate: String(numberValue(form.annualInterestRate)),
          tenureMonths: String(numberValue(form.tenureMonths)),
          securityValue: securedProduct ? String(numberValue(form.securityValue)) : ''
        }
      };

      persistRetailLoanApplication(application);
      router.push(`/loan_application?edit=${encodeURIComponent(applicationId)}`);
    } catch (error) {
      setFormError(error instanceof Error
        ? `The eligibility was checked, but could not be saved: ${error.message}`
        : 'The eligibility was checked, but could not be saved in this browser.');
    }
  }

  function reset() {
    if (!window.confirm('Cancel this eligibility assessment? All entered details and results will be cleared.')) return;
    setForm(initialForm());
    setErrors({});
    setAssessment(null);
    setFormError('');
  }

  const totals = form.rows.reduce((result, row) => {
    const amount = numberValue(row.amount) || 0;
    result[row.type] += amount;
    return result;
  }, { Income: 0, Expense: 0 });
  const filteredLeads = leads.filter(lead => (
    `${getLeadId(lead)} ${getLeadName(lead)} ${getLeadProduct(lead)}`
      .toLowerCase()
      .includes(leadSearch.trim().toLowerCase())
  ));

  return (
    <AppShell title="Loan Eligibility">
      <style>{styles}</style>
      <div className="eligibility-page">
        <header className="eligibility-heading">
          <h1 className="eligibility-title">Loan Eligibility</h1>
          <output className={`eligibility-status ${
            !assessment
              ? 'pending'
              : assessment.isEligible
                ? 'checked'
                : assessment.decision === 'Refer for Review'
                  ? 'review'
                  : 'rejected'
          }`}>
            {decision}
          </output>
        </header>

        <form onSubmit={submit} noValidate>
          <fieldset className="eligibility-form-fields" disabled={saving}>
            <div className="eligibility-layout">
              <div className="eligibility-main">
                <section className="form-panel">
                  <h2>Applicant</h2>
                  <div className="eligibility-fields applicant-fields">
                    <label className="eligibility-field lead-id-field" htmlFor="eligibility-lead-id">
                      <span>Lead ID *</span>
                      <div className="lead-id-control">
                        <input
                          id="eligibility-lead-id"
                          value={form.leadId}
                          onChange={event => update('leadId', event.target.value)}
                          required
                          aria-invalid={Boolean(errors.leadId)}
                          aria-describedby={errors.leadId ? 'eligibility-lead-id-error' : undefined}
                        />
                        <button
                          className="lead-search-button"
                          type="button"
                          onClick={openLeadPicker}
                          aria-label="Search leads"
                          title="Search leads"
                        >
                          <Search size={17} />
                        </button>
                      </div>
                      {errors.leadId && <small className="field-error" id="eligibility-lead-id-error">{errors.leadId}</small>}
                    </label>
                    <Field
                      label="Name of the Applicant *"
                      value={form.applicantName}
                      onChange={value => update('applicantName', value)}
                      error={errors.applicantName}
                      required
                      autoComplete="name"
                    />
                  </div>
                </section>

                <section className="form-panel">
                  <h2>Loan details</h2>
                  <div className="eligibility-fields loan-fields">
                    <label className="eligibility-field" htmlFor="eligibility-product-name">
                      <span>Loan Product *</span>
                      <select
                        id="eligibility-product-name"
                        value={form.productName}
                        onChange={event => update('productName', event.target.value)}
                        required
                        aria-invalid={Boolean(errors.productName)}
                        aria-describedby={errors.productName ? 'eligibility-product-name-error' : undefined}
                      >
                        <option value="">Select product</option>
                        {LOAN_PRODUCTS.map(product => <option key={product}>{product}</option>)}
                      </select>
                      {errors.productName && (
                        <small className="field-error" id="eligibility-product-name-error">
                          {errors.productName}
                        </small>
                      )}
                    </label>
                    <Field
                      label="Loan Amount (Rs.) *"
                      value={form.requestedAmount}
                      onChange={value => update('requestedAmount', value)}
                      error={errors.requestedAmount}
                      inputMode="decimal"
                      required
                    />
                    <Field
                      label="Application Int. Rate (%) *"
                      value={form.annualInterestRate}
                      onChange={value => update('annualInterestRate', value)}
                      error={errors.annualInterestRate}
                      inputMode="decimal"
                      required
                    />
                    <Field
                      label="Tenure (months) *"
                      value={form.tenureMonths}
                      onChange={value => update('tenureMonths', value)}
                      error={errors.tenureMonths}
                      inputMode="numeric"
                      required
                    />
                    <Field
                      label="Security Value (Rs.)"
                      value={form.securityValue}
                      onChange={value => update('securityValue', value)}
                      error={errors.securityValue}
                      inputMode="decimal"
                    />
                    <Field
                      label="Existing Monthly Debt (Rs.) *"
                      value={form.existingMonthlyDebt}
                      onChange={value => update('existingMonthlyDebt', value)}
                      error={errors.existingMonthlyDebt}
                      inputMode="decimal"
                      required
                      helpText="Enter total monthly repayments for existing loans. Keep 0 only if you have no existing debt."
                    />
                  </div>
                </section>

                <section className="form-panel income-panel">
                  <div className="panel-heading">
                    <h2>Income and expenses</h2>
                    <button
                      className="add-row"
                      type="button"
                      onClick={addRow}
                      disabled={form.rows.length >= MAX_FINANCIAL_ROWS}
                    >
                      <CirclePlus size={15} /> Add entry
                    </button>
                  </div>
                  <p className="table-help">
                    Add up to {MAX_FINANCIAL_ROWS} income or expense entries. Complete the required source and amount fields.
                    <span className="row-count">
                      {form.rows.length >= MAX_FINANCIAL_ROWS
                        ? `Maximum ${MAX_FINANCIAL_ROWS} reached`
                        : `${form.rows.length}/${MAX_FINANCIAL_ROWS} entries`}
                    </span>
                  </p>
                  <div className="table-scroll">
                    <table className="eligibility-table income-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Income / Expense Source</th>
                          <th>Income Amount (Rs.)</th>
                          <th>Expense Amount (Rs.)</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {form.rows.map(row => (
                          <tr key={row.id}>
                            <td>
                              <select
                                aria-label={`Type for row ${row.id}`}
                                value={row.type}
                                onChange={event => updateRow(row.id, 'type', event.target.value)}
                                required
                                aria-invalid={Boolean(errors[`row-${row.id}-type`])}
                              >
                                <option>Income</option>
                                <option>Expense</option>
                              </select>
                            </td>
                            <td>
                              <input
                                id={`row-${row.id}-source`}
                                aria-label={`${row.type} source for row ${row.id}`}
                                value={row.source}
                                onChange={event => updateRow(row.id, 'source', event.target.value)}
                                required
                                placeholder={row.type === 'Income' ? 'e.g. Salary' : 'e.g. Rent'}
                                aria-invalid={Boolean(errors[`row-${row.id}-source`])}
                                aria-describedby={errors[`row-${row.id}-source`] ? `row-${row.id}-source-error` : undefined}
                              />
                              {errors[`row-${row.id}-source`] && (
                                <small className="table-field-error" id={`row-${row.id}-source-error`}>
                                  {errors[`row-${row.id}-source`]}
                                </small>
                              )}
                            </td>
                            <td>
                              {row.type === 'Income' && (
                                <>
                                  <input
                                    id={`row-${row.id}-amount`}
                                    aria-label={`Income amount for row ${row.id}`}
                                    value={row.amount}
                                    onChange={event => updateRow(row.id, 'amount', event.target.value)}
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    required
                                    aria-invalid={Boolean(errors[`row-${row.id}-amount`])}
                                    aria-describedby={errors[`row-${row.id}-amount`] ? `row-${row.id}-amount-error` : undefined}
                                  />
                                  {errors[`row-${row.id}-amount`] && (
                                    <small className="table-field-error" id={`row-${row.id}-amount-error`}>
                                      {errors[`row-${row.id}-amount`]}
                                    </small>
                                  )}
                                </>
                              )}
                            </td>
                            <td>
                              {row.type === 'Expense' && (
                                <>
                                  <input
                                    id={`row-${row.id}-amount`}
                                    aria-label={`Expense amount for row ${row.id}`}
                                    value={row.amount}
                                    onChange={event => updateRow(row.id, 'amount', event.target.value)}
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    required
                                    aria-invalid={Boolean(errors[`row-${row.id}-amount`])}
                                    aria-describedby={errors[`row-${row.id}-amount`] ? `row-${row.id}-amount-error` : undefined}
                                  />
                                  {errors[`row-${row.id}-amount`] && (
                                    <small className="table-field-error" id={`row-${row.id}-amount-error`}>
                                      {errors[`row-${row.id}-amount`]}
                                    </small>
                                  )}
                                </>
                              )}
                            </td>
                            <td>
                              <button
                                className="row-remove"
                                type="button"
                                aria-label={`Remove row ${row.id}`}
                                onClick={() => removeRow(row.id)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr className="total-row">
                          <td colSpan="2">Total</td>
                          <td>{money(totals.Income)}</td>
                          <td>{money(totals.Expense)}</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {errors.income && <small className="field-error">{errors.income}</small>}
                </section>
              </div>

              <aside className="assessment-panel">
                <h2>Assessment</h2>
                <div className={`eligibility-results ${assessment ? 'calculated' : 'pending'}`}>
                  <ResultField
                    label="Indicative eligible amount (Rs.)"
                    value={assessment ? money(assessment.eligibleAmount) : 'Pending'}
                  />
                  <ResultField label="Interest (%)" value={assessment ? `${form.annualInterestRate}%` : 'Pending'} />
                  <ResultField label="Tenure (mo)" value={assessment ? form.tenureMonths : 'Pending'} />
                  <ResultField
                    label="EMI (Rs.)"
                    value={assessment ? money(assessment.eligibleEmi) : 'Pending'}
                  />
                </div>
                <p className={`assessment-state ${assessment ? 'calculated' : ''}`} role="status">
                  {assessment ? 'Values calculated from the submitted details.' : 'Results are pending assessment.'}
                </p>

                <div className="table-scroll ratio-scroll">
                  <table className="eligibility-table ratio-table">
                    <thead>
                      <tr><th>Financial ratio</th><th>Result</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row" title="Fixed Obligation to Income Ratio: existing monthly debt plus proposed EMI divided by monthly income after regular expenses.">
                          FOIR <span className="ratio-description">Debt + proposed EMI ÷ net income</span>
                        </th>
                        <td>{assessment ? percent(assessment.foir) : 'Pending'}</td>
                        <td>{assessment ? actionFor(assessment.foir, POLICY.reviewFoir, POLICY.maxFoir) : 'Pending'}</td>
                      </tr>
                      <tr>
                        <th scope="row" title="Debt-to-Income Ratio: existing monthly debt plus proposed EMI divided by gross monthly income.">
                          DTI <span className="ratio-description">Debt + proposed EMI ÷ gross income</span>
                        </th>
                        <td>{assessment ? percent(assessment.dti) : 'Pending'}</td>
                        <td>{assessment ? actionFor(assessment.dti, POLICY.reviewFoir, POLICY.maxFoir) : 'Pending'}</td>
                      </tr>
                      <tr>
                        <th scope="row" title="Loan-to-Value Ratio: requested loan amount divided by the value of the security offered.">
                          LTV <span className="ratio-description">Requested loan ÷ security value</span>
                        </th>
                        <td>{assessment ? percent(assessment.ltv) : 'Pending'}</td>
                        <td>{assessment ? assessment.ltv === null ? 'Optional' : ltvAction : 'Pending'}</td>
                      </tr>
                      <tr>
                        <th scope="row" title={`CIBIL score used for screening; ${POLICY.cibilFloor} is the indicative screening floor.`}>
                          CIBIL Score <span className="ratio-description">Screening floor {POLICY.cibilFloor}</span>
                        </th>
                        <td>
                          <input
                            className="score-input"
                            aria-label="CIBIL score"
                            value={form.cibilScore}
                            onChange={event => update('cibilScore', event.target.value)}
                            type="number"
                            inputMode="numeric"
                            step="any"
                            required
                            aria-invalid={Boolean(errors.cibilScore)}
                            aria-describedby={errors.cibilScore ? 'eligibility-cibil-score-error' : undefined}
                          />
                        </td>
                        <td>{cibilAction}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {errors.cibilScore && (
                  <small className="field-error" id="eligibility-cibil-score-error">
                    {errors.cibilScore}
                  </small>
                )}

                <div className="eligibility-actions">
                  <button className="primary-button" type="submit" disabled={saving}>
                    {saving ? 'Checking eligibility…' : 'Check Eligibility'}
                  </button>
                  <button className="secondary-button" type="button" onClick={reset}>
                    <RotateCcw size={15} /> Cancel
                  </button>
                  {assessment?.isEligible && (
                    <button className="continue-button" type="button" onClick={saveAndContinue}>
                      Save &amp; Continue
                    </button>
                  )}
                </div>
              </aside>
            </div>

            {assessment && (
              <div className={`assessment-result ${
                assessment.isEligible
                  ? 'eligible'
                  : assessment.decision === 'Refer for Review'
                    ? 'review'
                    : 'not-eligible'
              }`} role="status">
                <strong>{assessment.decision}</strong>
                {assessment.reasons.length > 0 && (
                  <ul>{assessment.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
                )}
                {!assessment.reasons.length && (
                  <p className="assessment-note">
                    INDICATIVE ONLY — FINAL APPROVAL SUBJECT TO VERIFICATION.
                  </p>
                )}
              </div>
            )}

            {formError && <p className="form-error" role="alert">{formError}</p>}

            {assessment?.isEligible && assessment.cibilScore >= POLICY.cibilFloor && (
              <details className="approval-letter">
                <summary>View in-principle approval letter</summary>
                <p className="letter-disclaimer">Draft only: this indicative estimate is not a loan sanction or a bank-issued approval.</p>
                <pre>{approvalLetter(form, assessment)}</pre>
              </details>
            )}
          </fieldset>
        </form>

        {leadPickerOpen && (
          <div
            className="lead-picker-overlay"
            role="presentation"
            onMouseDown={event => {
              if (event.target === event.currentTarget) setLeadPickerOpen(false);
            }}
          >
            <section
              className="lead-picker-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="lead-picker-title"
              onKeyDown={event => {
                if (event.key === 'Escape') setLeadPickerOpen(false);
              }}
            >
              <header className="lead-picker-header">
                <div>
                  <h2 id="lead-picker-title">Select a lead</h2>
                  <p>Search backend leads by lead ID or applicant name.</p>
                </div>
                <button
                  className="lead-picker-close"
                  type="button"
                  onClick={() => setLeadPickerOpen(false)}
                  aria-label="Close lead search"
                >
                  <X size={18} />
                </button>
              </header>
              <label className="lead-picker-search" htmlFor="lead-picker-search">
                <Search size={17} aria-hidden="true" />
                <input
                  id="lead-picker-search"
                  type="search"
                  value={leadSearch}
                  onChange={event => setLeadSearch(event.target.value)}
                  placeholder="Search by lead ID or applicant name"
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <div className="lead-picker-table-wrap">
                <table className="lead-picker-table">
                  <thead>
                    <tr>
                      <th scope="col">Lead ID</th>
                      <th scope="col">Applicant</th>
                      <th scope="col">Loan product</th>
                      <th scope="col">Loan amount (Rs.)</th>
                      <th scope="col" aria-label="Action" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.length ? (
                      filteredLeads.map((lead, index) => {
                        const leadId = getLeadId(lead);
                        return (
                          <tr key={leadId || index}>
                            <td className="lead-picker-id">{leadId || '—'}</td>
                            <td>{getLeadName(lead) || '—'}</td>
                            <td>{getLeadProduct(lead) || leadValue(lead, 'loanProductType', 'loan_product_type', 'product', 'productName', 'product_name') || '—'}</td>
                            <td>{leadValue(lead, 'loanAmount', 'loan_amount', 'requestedAmount', 'requested_amount', 'amount') || '—'}</td>
                            <td>
                              <button
                                className="lead-picker-select"
                                type="button"
                                onClick={() => selectLead(lead)}
                                disabled={!leadId}
                              >
                                Select
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="lead-picker-empty" colSpan="5">
                          {leads.length ? 'No leads match your search.' : 'No leads are available.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  inputMode,
  required = false,
  autoComplete = 'off',
  helpText
}) {
  const id = `eligibility-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const errorId = `${id}-error`;
  const describedBy = [
    helpText ? `${id}-help` : null,
    error ? errorId : null
  ].filter(Boolean).join(' ') || undefined;
  return (
    <label className="eligibility-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        type={inputMode ? 'number' : 'text'}
        inputMode={inputMode || 'text'}
        step={inputMode ? 'any' : undefined}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        autoComplete={autoComplete}
      />
      {helpText && <small className="field-help" id={`${id}-help`}>{helpText}</small>}
      {error && <small className="field-error" id={errorId}>{error}</small>}
    </label>
  );
}

function ResultField({ label, value }) {
  return (
    <div className="result-field">
      <span>{label}</span>
      <output>{value}</output>
    </div>
  );
}

const styles = `
.los-page-wrap:has(> .eligibility-page){display:flex;align-items:flex-start;justify-content:center;width:100%;max-width:none;margin:0 auto;box-sizing:border-box}
.eligibility-page{width:100%;max-width:1480px;min-width:0;margin:0 auto;padding:24px 32px 40px;border-radius:14px;background:#f3f8f6;color:#202b36}
.eligibility-heading{display:flex;min-height:30px;align-items:center;justify-content:space-between;gap:16px;margin:0 0 10px}
.eligibility-title{margin:0;color:#17212b;font-size:24px;font-weight:700;letter-spacing:-.02em}
.eligibility-status{display:block;max-width:190px;overflow:hidden;padding:5px 11px;border:1px solid #e5e9ed;border-radius:999px;background:#f7f8fa;color:#606a73;font-size:11px;text-overflow:ellipsis;white-space:nowrap}
.eligibility-status.checked{border-color:#aadbb1;background:#edf8ef;color:#26703a;font-weight:600}
.eligibility-status.pending{border-color:#d6dde4;background:#f4f7fa;color:#576675}
.eligibility-status.review{border-color:#e7d19c;background:#fff8e8;color:#805c12;font-weight:600}
.eligibility-status.rejected{border-color:#efc4c4;background:#fff3f3;color:#9a3434;font-weight:600}
.eligibility-form-fields{min-width:0;margin:0;padding:0;border:0}
.eligibility-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(330px,.95fr);gap:18px;align-items:start}
.eligibility-main{display:grid;gap:9px;min-width:0}
.form-panel,.assessment-panel{min-width:0;padding:16px;border:1px solid #dce8e3;border-radius:12px;background:#fff;box-shadow:0 4px 16px #173a2d0b}
.assessment-panel{position:sticky;top:16px}
.form-panel h2,.assessment-panel h2{margin:0;color:#173c36;font-size:16px;font-weight:700}
.eligibility-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start}
.applicant-fields{grid-template-columns:minmax(150px,.62fr) minmax(0,1.38fr)}
.eligibility-field{display:grid;gap:5px;min-width:0;color:#53645f;font-size:12px;font-weight:500;line-height:1.35}
.form-panel h2+.eligibility-fields{margin-top:12px}
.eligibility-field input,.eligibility-field select,.result-field input{width:100%;height:40px;min-width:0;padding:0 10px;border:1px solid #cbd9d4;border-radius:7px;background:#fff;color:#20262c;font:14px Arial,sans-serif}
.eligibility-field input:focus,.eligibility-field select:focus,.score-input:focus,.result-field input:focus{outline:3px solid #168b6324;border-color:#168b63}
.eligibility-field input[aria-invalid=true],.eligibility-field select[aria-invalid=true],.score-input[aria-invalid=true],.result-field input[aria-invalid=true]{border-color:#bd4d4d;background:#fffafa}
.field-help{color:#747d84;font-size:10px;font-weight:400;line-height:1.35}
.lead-id-field{max-width:270px}
.lead-id-control{display:flex;align-items:center;gap:6px;min-width:0}
.lead-id-control input{flex:1;width:0}
.lead-search-button{display:grid;flex:0 0 40px;width:40px;height:40px;place-items:center;border:1px solid #b9d6cb;border-radius:7px;background:#f4faf7;color:#28705e;cursor:pointer}
.lead-search-button:hover{border-color:#168b63;background:#eaf6ef;color:#11634e}
.lead-picker-overlay{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:20px;background:#102d35a6}
.lead-picker-dialog{display:flex;flex-direction:column;width:min(820px,100%);max-height:88vh;overflow:hidden;border:1px solid #dce8e3;border-radius:10px;background:#fff;box-shadow:0 24px 70px #0d262d40}
.lead-picker-header{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px 20px;border-bottom:1px solid #e5ecea;background:#f8fbfa}
.lead-picker-header h2{margin:0;color:#1c4847;font-size:18px}
.lead-picker-header p{margin:4px 0 0;color:#718486;font-size:12px}
.lead-picker-close{display:grid;flex:0 0 34px;width:34px;height:34px;place-items:center;border:1px solid #dce6e3;border-radius:5px;background:#fff;color:#526a6c;cursor:pointer}
.lead-picker-close:hover{background:#eef5f3}
.lead-picker-search{display:flex;align-items:center;gap:9px;height:40px;margin:16px 18px 10px;padding:0 11px;border:1px solid #cbd9d7;border-radius:6px;color:#718486}
.lead-picker-search:focus-within{border-color:#568e88;box-shadow:0 0 0 3px #177e7a19}
.lead-picker-search input{width:100%;height:100%;border:0;outline:0;background:transparent;color:#203c42;font:12px Arial,sans-serif}
.lead-picker-table-wrap{flex:1;min-height:0;max-width:100%;margin:0 18px 18px;overflow:auto;border:1px solid #e1e9e6;border-radius:5px}
.lead-picker-table{width:100%;min-width:680px;border-collapse:collapse;table-layout:auto}
.lead-picker-table th,.lead-picker-table td{height:45px;padding:8px 11px;border-bottom:1px solid #edf1f0;text-align:left;color:#354d4f;font-size:12px}
.lead-picker-table th{position:sticky;top:0;background:#f5f8f7;color:#607577;font-size:10px;font-weight:700;text-transform:uppercase}
.lead-picker-table tbody tr:hover{background:#fbfdfc}
.lead-picker-table tbody tr:last-child td{border-bottom:0}
.lead-picker-id{color:#176e67!important;font-weight:750}
.lead-picker-select{min-height:30px;padding:0 11px;border:1px solid #177e7a;border-radius:5px;background:#177e7a;color:#fff;font-size:11px;font-weight:700;cursor:pointer}
.lead-picker-select:hover{background:#0c6662}
.lead-picker-select:disabled{opacity:.5;cursor:not-allowed}
.lead-picker-empty{height:90px!important;text-align:center!important;color:#718284!important}
.lead-picker-error{margin:0 18px 10px;padding:9px 11px;border:1px solid #e7cccc;border-radius:5px;background:#fff7f7;color:#a43838;font-size:12px}
.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
.table-help{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;color:#687a74;font-size:11px;line-height:1.45}
.row-count{flex:none;color:#168b73;font-size:10px;font-weight:700}
.add-row{display:inline-flex;min-height:34px;align-items:center;gap:6px;padding:5px 11px;border:1px solid #b9d6cb;border-radius:7px;background:#f6fbf8;color:#23604d;font-size:12px;font-weight:600;cursor:pointer}
.add-row:hover{border-color:#168b63;background:#edf8f2}
.add-row:disabled{opacity:.5;cursor:not-allowed}
.table-scroll{overflow-x:auto;border-radius:6px}
.eligibility-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px}
.eligibility-table th,.eligibility-table td{height:40px;padding:5px 6px;border-bottom:1px solid #e5ece8;text-align:center;vertical-align:middle}
.eligibility-table thead th{position:sticky;top:0;z-index:1;height:32px;background:#f5f9f7;color:#52675f;font-size:10px;font-weight:600}
.eligibility-table tbody th{color:#414950}
.eligibility-table td input,.eligibility-table td select{width:100%;height:34px;min-width:0;padding:0 7px;border:1px solid #d3dfda;border-radius:6px;background:#fff;color:#242b30;font-size:12px}
.table-field-error{display:block;margin-top:3px;color:#a52e2e;font-size:9px;font-weight:400;text-align:left}
.income-table{min-width:600px}
.income-table th:first-child{width:12%}.income-table th:nth-child(2){width:24%}.income-table th:nth-child(3),.income-table th:nth-child(4){width:26%}.income-table th:last-child{width:12%}
.income-table tbody td:nth-child(2){text-align:left}
.income-table .total-row{height:28px;font-weight:600}
.total-row td{height:28px;border-bottom:0}
.row-remove{display:inline-grid;width:23px;height:25px;place-items:center;border:0;border-radius:5px;background:transparent;color:#a34a4a;cursor:pointer}
.row-remove:hover{background:#fff0f0}
.assessment-panel h2{margin-bottom:8px}
.eligibility-results{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 5px;padding:12px;border-radius:10px}
.eligibility-results.pending{background:#f1f4f7}
.eligibility-results.calculated{background:#dff2e1;box-shadow:inset 0 0 0 1px #b5dcb8}
.result-field{display:grid;gap:3px;min-width:0;color:#4f6251;font-size:10px;font-weight:500}
.result-field output,.result-field input{display:flex;align-items:center;justify-content:center;min-width:0;height:25px;padding:0 5px;border:0;border-radius:4px;background:transparent;color:#243b29;font:600 12px Arial,sans-serif;text-align:center}
.eligibility-results .result-field:first-child{grid-column:1/-1;padding-bottom:5px;border-bottom:1px solid #a9d8a8}
.eligibility-results .result-field:first-child output{justify-content:flex-start;font-size:14px}
.eligibility-results .result-field input{height:25px;border:1px solid #b5d8b3;background:#fff}
.ratio-scroll{margin-top:2px}
.ratio-table th:first-child{width:46%}.ratio-table th:nth-child(2){width:28%}.ratio-table th:last-child{width:26%}
.ratio-table thead th{height:24px}
.ratio-table th[scope=row]{text-align:left;font-weight:500}
.ratio-table td:last-child{color:#697178;font-size:9px}
.ratio-description{display:block;margin-top:2px;color:#737b81;font-size:8px;font-weight:400;line-height:1.25}
.assessment-state{margin:0 0 4px;color:#717b84;font-size:9px;line-height:1.3}
.assessment-state.calculated{color:#26703a;font-weight:600}
.score-input{text-align:center}
.assessment-panel>.field-error{margin:2px 0 4px}
.eligibility-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}
.primary-button,.secondary-button,.continue-button{display:inline-flex;min-width:0;min-height:38px;align-items:center;justify-content:center;gap:6px;padding:6px 8px;border:1px solid #d2d5d7;border-radius:7px;background:#fff;color:#30383e;font-size:11px;font-weight:600;line-height:1.25;text-align:center;cursor:pointer}
.primary-button{border-color:#168b63;background:#168b63;color:#fff}
.primary-button:hover{background:#117451}
.continue-button{grid-column:1/-1;border-color:#287344;background:#287344;color:#fff}
.continue-button:hover{background:#1e5d36}
.secondary-button:hover{border-color:#aeb5ba;background:#f7f8f8}
.primary-button:disabled{opacity:.65;cursor:wait}
.assessment-result{margin:10px 0;padding:12px 14px;border:1px solid #add5b2;border-radius:8px;background:#f2faf2;color:#315b2d;font-size:13px;line-height:1.5}
.assessment-result.eligible{border-color:#add5b2;background:#f2faf2;color:#315b2d}
.assessment-result.review{border-color:#e7d19c;background:#fff9ed;color:#79570f}
.assessment-result p{margin:6px 0 0}
.assessment-note{font-size:11px;font-weight:700;letter-spacing:.025em}
.assessment-result ul{margin:7px 0 0;padding-left:20px}
.assessment-result.not-eligible{border-color:#e3bcbc;background:#fff6f6;color:#8f3030}
.approval-letter{margin-top:12px;border:1px solid #d5dce1;border-radius:7px;padding:11px 13px;font-size:12px}
.approval-letter summary{cursor:pointer;font-weight:700}
.letter-disclaimer{color:#8f3030;font-size:11px}
.approval-letter pre{overflow:auto;white-space:pre-wrap;font:12px/1.6 Arial,sans-serif}
.field-error{display:block;color:#a52e2e;font-size:10px;font-weight:400;line-height:1.4}
.form-error{margin:10px 0;padding:10px 12px;border:1px solid #e3bcbc;border-radius:7px;background:#fff6f6;color:#8f3030;font-size:12px}
@media(max-width:960px){.eligibility-layout{grid-template-columns:minmax(0,1fr)}.assessment-panel{position:static}.eligibility-fields{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:480px){.eligibility-page{padding:14px;border-radius:0}.eligibility-layout{grid-template-columns:minmax(0,1fr)}.eligibility-heading{margin-bottom:10px}.eligibility-title{font-size:20px}.form-panel,.assessment-panel{padding:12px}.eligibility-fields,.applicant-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.lead-id-field{max-width:none}.table-help{align-items:flex-start;flex-direction:column;gap:4px}.lead-picker-overlay{padding:10px}.lead-picker-header{padding:14px}.lead-picker-table-wrap{margin:0 12px 12px}.lead-picker-search{margin:12px 12px 8px}}
@media(max-width:360px){.eligibility-fields,.applicant-fields{grid-template-columns:1fr}}
`;
