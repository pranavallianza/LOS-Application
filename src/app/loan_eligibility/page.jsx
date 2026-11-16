'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CirclePlus, RotateCcw, Trash2 } from 'lucide-react';
import AppShell from '../../components/AppShell';
import { persistRetailLoanApplication } from '../../components/RetailLoanApplicationForm';
import { assessLoanEligibility } from '../../services/loanEligibility';

const POLICY = {
  maxFoir: 50,
  cibilFloor: 650,
  maxHomeLtv: {
    upTo30L: 90,
    upTo75L: 80,
    above75L: 75
  },
  minTenureMonths: 6,
  maxTenureMonths: 480,
  maxAnnualInterestRate: 60
};

const LOAN_PRODUCTS = [
  'Personal loan',
  'Home loan',
  'Vehicle loan',
  'Business loan',
  'Gold loan',
  'Other secured loan'
];

const APPLICANT_NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '-][\p{L}\p{M}]+)*$/u;
const DECIMAL_AMOUNT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

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
  existingMonthlyDebt: '',
  rows: [makeRow(1, 'Income'), makeRow(2, 'Expense')]
});

const numberValue = value => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

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

  const leadId = String(form.leadId ?? '').trim();
  const applicantName = String(form.applicantName ?? '').trim();
  const productName = String(form.productName ?? '').trim();

  if (!/^[A-Z0-9-]{1,30}$/i.test(leadId)) {
    errors.leadId = 'Enter a valid Lead ID.';
  }
  const applicantNameLength = Array.from(applicantName).length;
  if (!applicantName) {
    errors.applicantName = 'Applicant name is required.';
  } else if (applicantNameLength < 2 || applicantNameLength > 100) {
    errors.applicantName = 'Applicant name must be between 2 and 100 characters.';
  } else if (!APPLICANT_NAME_PATTERN.test(applicantName)) {
    errors.applicantName = 'Use letters only. Spaces, apostrophes, and hyphens are allowed.';
  }
  if (!LOAN_PRODUCTS.includes(productName)) {
    errors.productName = 'Select a valid loan product.';
  }

  const requiredAmounts = [
    ['requestedAmount', 'Enter a loan amount greater than zero.'],
    ['annualInterestRate', 'Enter a valid annual interest rate.'],
    ['tenureMonths', 'Enter a valid tenure in months.'],
    ['cibilScore', 'Enter a valid CIBIL score.']
  ];
  requiredAmounts.forEach(([field, message]) => {
    const value = form[field];
    const parsedValue = numberValue(value);
    if (
      String(value ?? '').trim() === '' ||
      !DECIMAL_AMOUNT_PATTERN.test(String(value)) ||
      parsedValue === null ||
      !Number.isFinite(parsedValue)
    ) {
      errors[field] = message;
    }
  });

  const requestedAmount = numberValue(form.requestedAmount);
  if (requestedAmount !== null && requestedAmount <= 0) {
    errors.requestedAmount = 'Enter a loan amount greater than zero.';
  }
  const annualInterestRate = numberValue(form.annualInterestRate);
  if (
    annualInterestRate !== null &&
    (
      annualInterestRate <= 0 ||
      annualInterestRate > POLICY.maxAnnualInterestRate
    )
  ) {
    errors.annualInterestRate = `Enter a rate above 0% and no more than ${POLICY.maxAnnualInterestRate}%.`;
  }
  const existingMonthlyDebt = String(form.existingMonthlyDebt ?? '').trim();
  const parsedExistingMonthlyDebt = numberValue(existingMonthlyDebt);
  if (
    existingMonthlyDebt !== '' &&
    (
      !DECIMAL_AMOUNT_PATTERN.test(existingMonthlyDebt) ||
      parsedExistingMonthlyDebt === null ||
      !Number.isFinite(parsedExistingMonthlyDebt) ||
      parsedExistingMonthlyDebt < 0
    )
  ) {
    errors.existingMonthlyDebt = 'Enter zero or a valid non-negative monthly debt amount.';
  }
  const securityValue = String(form.securityValue ?? '').trim();
  const parsedSecurityValue = numberValue(securityValue);
  if (
    securityValue !== '' &&
    (
      !DECIMAL_AMOUNT_PATTERN.test(securityValue) ||
      parsedSecurityValue === null ||
      !Number.isFinite(parsedSecurityValue) ||
      parsedSecurityValue <= 0
    )
  ) {
    errors.securityValue = 'Enter a valid security value or leave it blank.';
  }
  const tenureMonths = String(form.tenureMonths ?? '').trim();
  const parsedTenureMonths = numberValue(tenureMonths);
  if (
    !/^\d+$/.test(tenureMonths) ||
    parsedTenureMonths === null ||
    !Number.isFinite(parsedTenureMonths) ||
    parsedTenureMonths < POLICY.minTenureMonths ||
    parsedTenureMonths > POLICY.maxTenureMonths
  ) {
    errors.tenureMonths = `Choose a tenure between ${POLICY.minTenureMonths} and ${POLICY.maxTenureMonths} months.`;
  }
  const cibilScore = String(form.cibilScore ?? '').trim();
  const parsedCibilScore = numberValue(cibilScore);
  if (
    !/^\d{3}$/.test(cibilScore) ||
    parsedCibilScore === null ||
    !Number.isFinite(parsedCibilScore) ||
    parsedCibilScore < 300 ||
    parsedCibilScore > 900
  ) {
    errors.cibilScore = 'CIBIL score must be between 300 and 900.';
  }

  const rows = Array.isArray(form.rows) ? form.rows : [];
  if (!rows.some(row => row.type === 'Income' && numberValue(row.amount) > 0)) {
    errors.income = 'Enter at least one positive income amount.';
  }
  rows.forEach(row => {
    const source = String(row.source ?? '').trim();
    const amount = String(row.amount ?? '').trim();
    if (!source && !amount) return;
    if (!['Income', 'Expense'].includes(row.type)) {
      errors[`row-${row.id}-type`] = 'Select income or expense.';
    }
    if (!source) {
      errors[`row-${row.id}-source`] = 'Enter a source.';
    } else if (Array.from(source).length > 100 || /[\u0000-\u001F\u007F]/.test(source)) {
      errors[`row-${row.id}-source`] = 'Source must be 100 characters or fewer and contain no control characters.';
    }
    if (
      amount === '' ||
      !DECIMAL_AMOUNT_PATTERN.test(amount) ||
      numberValue(amount) === null ||
      !Number.isFinite(numberValue(amount)) ||
      numberValue(amount) < 0
    ) {
      errors[`row-${row.id}-amount`] = 'Enter a non-negative amount.';
    }
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

  const calculated = useMemo(() => calculateAssessment(form), [form]);
  const securedProduct = isSecuredProduct(form.productName);
  const hasCibil = Number.isFinite(calculated.cibilScore);
  const hasLtvLimit = Number.isFinite(calculated.ltvLimit);
  const cibilAction = hasCibil
    ? calculated.cibilScore >= POLICY.cibilFloor ? 'Within limit' : 'Outside limit'
    : 'Enter details';
  const ltvAction = !Number.isFinite(calculated.ltv)
    ? 'Optional'
    : hasLtvLimit
      ? actionFor(calculated.ltv, calculated.ltvLimit - 5, calculated.ltvLimit)
      : 'Calculated';
  const decision = assessment
    ? assessment.decision
    : 'Not checked';

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
    setErrors(current => ({
      ...current,
      [`row-${id}-source`]: '',
      [`row-${id}-amount`]: '',
      income: ''
    }));
    setAssessment(null);
    setFormError('');
  }

  function addRow() {
    setForm(current => ({
      ...current,
      rows: [...current.rows, makeRow(Math.max(0, ...current.rows.map(row => row.id)) + 1)]
    }));
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
      [`row-${id}-source`]: '',
      [`row-${id}-amount`]: '',
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

    const result = calculateAssessment(form);
    const reasons = [];
    if (result.cibilScore < POLICY.cibilFloor) {
      reasons.push(`CIBIL score is below the indicative ${POLICY.cibilFloor} screening floor.`);
    }
    if (result.eligibleAmount <= 0) {
      reasons.push('The entered income and expenses do not support an eligible loan amount.');
    }

    let resultDecision = 'In-principle eligible';
    if (reasons.length) {
      resultDecision = 'Not eligible — screening criteria not met';
    } else if (result.eligibleAmount < numberValue(form.requestedAmount)) {
      resultDecision = 'Eligible for a reduced amount';
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
      let finalDecision = resultDecision;
      let finalReasons = reasons;
      let finalEligibleAmount = result.eligibleAmount;

      if (typeof remoteDecision === 'boolean') {
        finalDecision = remoteDecision ? 'In-principle eligible' : 'Not eligible — lender assessment';
        finalReasons = remoteDecision ? [] : [remote?.message || 'The lender assessment did not approve this application.'];
      } else if (typeof remoteDecision === 'string') {
        finalDecision = remoteDecision;
        if (/not eligible|ineligible|reject|declin|outside|review|pending/i.test(remoteDecision)) {
          finalReasons = [remote?.message || 'The lender assessment did not approve this application.'];
        } else {
          finalReasons = [];
        }
      }

      if (remoteEligibleAmount !== null && remoteEligibleAmount >= 0) {
        finalEligibleAmount = remoteEligibleAmount;
      }

      const finalEligibleEmi = finalEligibleAmount > 0
        ? calculateEmi(
          finalEligibleAmount,
          numberValue(form.annualInterestRate),
          numberValue(form.tenureMonths)
        )
        : 0;
      const decisionNeedsReview = /not eligible|ineligible|reject|declin|outside|review|pending/i
        .test(finalDecision);

      setAssessment({
        ...result,
        eligibleAmount: finalEligibleAmount,
        eligibleEmi: finalEligibleEmi,
        decision: finalDecision,
        reasons: finalReasons,
        isEligible: finalReasons.length === 0 && !decisionNeedsReview && finalEligibleAmount > 0
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

  return (
    <AppShell title="Loan Eligibility">
      <style>{styles}</style>
      <div className="eligibility-page">
        <header className="eligibility-heading">
          <h1 className="eligibility-title">Loan Eligibility</h1>
          <output className={`eligibility-status ${assessment?.isEligible ? 'checked' : assessment ? 'rejected' : ''}`}>
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
                    <Field
                      label="Lead ID *"
                      value={form.leadId}
                      onChange={value => update('leadId', value)}
                      error={errors.leadId}
                      required
                      maxLength={30}
                    />
                    <Field
                      label="Name of the Applicant *"
                      value={form.applicantName}
                      onChange={value => update('applicantName', value)}
                      error={errors.applicantName}
                      required
                      maxLength={100}
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
                      label="Existing Monthly Debt (Rs.)"
                      value={form.existingMonthlyDebt}
                      onChange={value => update('existingMonthlyDebt', value)}
                      error={errors.existingMonthlyDebt}
                      inputMode="decimal"
                    />
                  </div>
                </section>

                <section className="form-panel income-panel">
                  <div className="panel-heading">
                    <h2>Income and expenses</h2>
                    <button className="add-row" type="button" onClick={addRow}>
                      <CirclePlus size={15} /> Add row
                    </button>
                  </div>
                  <div className="table-scroll">
                    <table className="eligibility-table income-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Source</th>
                          <th>Income Rs.</th>
                          <th>Expense Rs.</th>
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
                              >
                                <option>Income</option>
                                <option>Expense</option>
                              </select>
                            </td>
                            <td>
                              <input
                                aria-label={`Source for row ${row.id}`}
                                value={row.source}
                                onChange={event => updateRow(row.id, 'source', event.target.value)}
                                maxLength={100}
                                aria-invalid={Boolean(errors[`row-${row.id}-source`])}
                              />
                              {errors[`row-${row.id}-source`] && (
                                <small className="table-field-error">{errors[`row-${row.id}-source`]}</small>
                              )}
                            </td>
                            <td>
                              {row.type === 'Income' && (
                                <>
                                  <input
                                    aria-label={`Income amount for row ${row.id}`}
                                    value={row.amount}
                                    onChange={event => updateRow(row.id, 'amount', event.target.value)}
                                    inputMode="decimal"
                                    aria-invalid={Boolean(errors[`row-${row.id}-amount`])}
                                  />
                                  {errors[`row-${row.id}-amount`] && (
                                    <small className="table-field-error">{errors[`row-${row.id}-amount`]}</small>
                                  )}
                                </>
                              )}
                            </td>
                            <td>
                              {row.type === 'Expense' && (
                                <>
                                  <input
                                    aria-label={`Expense amount for row ${row.id}`}
                                    value={row.amount}
                                    onChange={event => updateRow(row.id, 'amount', event.target.value)}
                                    inputMode="decimal"
                                    aria-invalid={Boolean(errors[`row-${row.id}-amount`])}
                                  />
                                  {errors[`row-${row.id}-amount`] && (
                                    <small className="table-field-error">{errors[`row-${row.id}-amount`]}</small>
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
                <div className="eligibility-results">
                  <ResultField
                    label="Loan Eligible (Rs.)"
                    value={assessment?.isEligible ? money(assessment.eligibleAmount) : '—'}
                  />
                  <ResultField label="Interest (%)" value={form.annualInterestRate || '—'} />
                  <ResultField label="Tenure (mo)" value={form.tenureMonths || '—'} />
                  <ResultField
                    label="EMI (Rs.)"
                    value={assessment?.isEligible ? money(assessment.eligibleEmi) : '—'}
                  />
                </div>

                <div className="table-scroll ratio-scroll">
                  <table className="eligibility-table ratio-table">
                    <thead>
                      <tr><th>Assessment</th><th>Result</th><th aria-label="Status" /></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">FOIR</th>
                        <td>{percent(calculated.foir)}</td>
                        <td>{actionFor(calculated.foir, 40, POLICY.maxFoir)}</td>
                      </tr>
                      <tr>
                        <th scope="row">DTI</th>
                        <td>{percent(calculated.dti)}</td>
                        <td>{actionFor(calculated.dti, 40, POLICY.maxFoir)}</td>
                      </tr>
                      <tr>
                        <th scope="row">LTV</th>
                        <td>{percent(calculated.ltv)}</td>
                        <td>{calculated.ltv === null ? 'Optional' : ltvAction}</td>
                      </tr>
                      <tr>
                        <th scope="row">CIBIL Score</th>
                        <td>
                          <input
                            className="score-input"
                            aria-label="CIBIL score"
                            value={form.cibilScore}
                            onChange={event => update('cibilScore', event.target.value)}
                            inputMode="numeric"
                            maxLength={3}
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

            <p className="policy-note">
              Indicative screening only. Enter gross monthly income, regular living expenses, and existing loan
              repayments separately. FOIR is existing debt plus proposed EMI divided by income after regular
              expenses; DTI is existing debt plus proposed EMI divided by gross monthly income. Home-loan
              LTV limits shown are indicative; the lender&apos;s approved policy and verification determine final terms.
            </p>

            {assessment && (
              <div className={`assessment-result ${assessment.isEligible ? '' : 'not-eligible'}`} role="status">
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
  maxLength,
  autoComplete = 'off'
}) {
  const id = `eligibility-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const errorId = `${id}-error`;
  return (
    <label className="eligibility-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        inputMode={inputMode || 'text'}
        required={required}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        autoComplete={autoComplete}
      />
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
.eligibility-page{max-width:1280px;margin:0 auto;padding:16px 20px 32px;color:#202b36}
.eligibility-heading{display:flex;min-height:30px;align-items:center;justify-content:space-between;gap:16px;margin:0 0 10px}
.eligibility-title{margin:0;color:#17212b;font-size:20px;font-weight:700;letter-spacing:-.02em}
.eligibility-status{display:block;max-width:190px;overflow:hidden;padding:5px 11px;border:1px solid #e5e9ed;border-radius:999px;background:#f7f8fa;color:#606a73;font-size:11px;text-overflow:ellipsis;white-space:nowrap}
.eligibility-status.checked{border-color:#aadbb1;background:#edf8ef;color:#26703a;font-weight:600}
.eligibility-status.rejected{border-color:#efc4c4;background:#fff3f3;color:#9a3434;font-weight:600}
.eligibility-form-fields{min-width:0;margin:0;padding:0;border:0}
.eligibility-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(170px,1fr);gap:12px;align-items:start}
.eligibility-main{display:grid;gap:9px;min-width:0}
.form-panel,.assessment-panel{min-width:0;padding:10px;border:1px solid #dedfe1;border-radius:10px;background:#fff}
.form-panel h2,.assessment-panel h2{margin:0;color:#252a2f;font-size:13px;font-weight:700}
.eligibility-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:start}
.applicant-fields{grid-template-columns:repeat(2,minmax(0,1fr))}
.eligibility-field{display:grid;gap:4px;min-width:0;color:#5d6268;font-size:11px;font-weight:500;line-height:1.3}
.form-panel h2+.eligibility-fields{margin-top:8px}
.eligibility-field input,.eligibility-field select,.result-field input{width:100%;height:34px;min-width:0;padding:0 9px;border:1px solid #d9dcdf;border-radius:6px;background:#fff;color:#20262c;font:13px Arial,sans-serif}
.eligibility-field input:focus,.eligibility-field select:focus,.score-input:focus,.result-field input:focus{outline:3px solid #168b6324;border-color:#168b63}
.eligibility-field input[aria-invalid=true],.eligibility-field select[aria-invalid=true],.score-input[aria-invalid=true],.result-field input[aria-invalid=true]{border-color:#bd4d4d;background:#fffafa}
.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
.add-row{display:inline-flex;min-height:28px;align-items:center;gap:5px;padding:4px 9px;border:1px solid #d0d2d4;border-radius:7px;background:#fff;color:#38424a;font-size:11px;font-weight:600;cursor:pointer}
.add-row:hover{border-color:#168b63;background:#f4faf6}
.table-scroll{overflow-x:auto;border-radius:6px}
.eligibility-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px}
.eligibility-table th,.eligibility-table td{height:34px;padding:3px 4px;border-bottom:1px solid #e7e8e9;text-align:center;vertical-align:middle}
.eligibility-table thead th{height:25px;color:#777e84;font-size:9px;font-weight:500}
.eligibility-table tbody th{color:#414950}
.eligibility-table td input,.eligibility-table td select{width:100%;height:29px;min-width:0;padding:0 5px;border:1px solid #dfe1e3;border-radius:5px;background:#fff;color:#242b30;font-size:11px}
.table-field-error{display:block;margin-top:3px;color:#a52e2e;font-size:9px;font-weight:400;text-align:left}
.income-table th:first-child{width:19%}.income-table th:nth-child(2){width:22%}.income-table th:nth-child(3),.income-table th:nth-child(4){width:24%}.income-table th:last-child{width:11%}
.income-table tbody td:nth-child(2){text-align:left}
.income-table .total-row{height:28px;font-weight:600}
.total-row td{height:28px;border-bottom:0}
.row-remove{display:inline-grid;width:23px;height:25px;place-items:center;border:0;border-radius:5px;background:transparent;color:#a34a4a;cursor:pointer}
.row-remove:hover{background:#fff0f0}
.assessment-panel h2{margin-bottom:8px}
.eligibility-results{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 8px;padding:9px;border-radius:9px;background:#c9eac8}
.result-field{display:grid;gap:3px;min-width:0;color:#4f6251;font-size:10px;font-weight:500}
.result-field output,.result-field input{display:flex;align-items:center;justify-content:center;min-width:0;height:25px;padding:0 5px;border:0;border-radius:4px;background:transparent;color:#243b29;font:600 12px Arial,sans-serif;text-align:center}
.eligibility-results .result-field:first-child{grid-column:1/-1;padding-bottom:5px;border-bottom:1px solid #a9d8a8}
.eligibility-results .result-field:first-child output{justify-content:flex-start;font-size:14px}
.eligibility-results .result-field input{height:25px;border:1px solid #b5d8b3;background:#fff}
.ratio-scroll{margin-top:2px}
.ratio-table th:first-child{width:34%}.ratio-table th:nth-child(2){width:37%}.ratio-table th:last-child{width:29%}
.ratio-table thead th{height:24px}
.ratio-table th[scope=row]{text-align:left;font-weight:500}
.ratio-table td:last-child{color:#697178;font-size:9px}
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
.policy-note{margin:10px 0;color:#737b81;font-size:10px;line-height:1.5}
.assessment-result{margin:10px 0;padding:12px 14px;border:1px solid #add5b2;border-radius:8px;background:#f2faf2;color:#315b2d;font-size:13px;line-height:1.5}
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
@media(max-width:480px){.eligibility-page{padding:12px}.eligibility-layout{grid-template-columns:minmax(0,1fr)}.eligibility-heading{margin-bottom:9px}.eligibility-title{font-size:18px}.eligibility-fields{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:360px){.eligibility-fields,.applicant-fields{grid-template-columns:1fr}.income-table{min-width:380px}}
`;
