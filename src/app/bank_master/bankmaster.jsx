'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Landmark,
  MapPin,
  RotateCcw,
  Save,
  SlidersHorizontal
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import PageHeader from '../../components/PageHeader';
import { getLookupOptions, getLookupTypes } from '../../services/lookups';

const steps = [
  { id: 'bank', label: 'Bank Info', icon: Building2 },
  { id: 'address', label: 'Address Details', icon: MapPin },
  { id: 'accounts', label: 'Account Details', icon: Landmark },
  { id: 'limits', label: 'Limit Details', icon: SlidersHorizontal }
];

const emptyAccount = () => ({ particulars: '', bankName: '', accountType: '', accountNumber: '', micrCode: '', ifscCode: '' });
const bankMasterLookups = [
  { field: 'addressType', label: 'Address Type' },
  { field: 'particulars', label: 'Particulars' },
  { field: 'accountType', label: 'Account Type' },
  { field: 'approvalAuthority', label: 'Loan Approval Authority' }
];
const normalizeLookupName = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const validateAccount = (account, prefix = 'account-draft-') => {
  const errors = {};
  for (const [key, label] of [['bankName', 'Bank name'], ['accountType', 'Account type'], ['accountNumber', 'Account number'], ['micrCode', 'MICR code'], ['ifscCode', 'IFSC code']]) {
    if (!String(account[key] || '').trim()) errors[`${prefix}${key}`] = `${label} is required.`;
  }
  if (account.accountNumber && !/^[A-Z0-9 -]{4,34}$/i.test(account.accountNumber.trim())) {
    errors[`${prefix}accountNumber`] = 'Use 4–34 letters, numbers, spaces, or hyphens.';
  }
  if (account.micrCode && !/^\d{9}$/.test(account.micrCode.trim())) errors[`${prefix}micrCode`] = 'MICR code must contain 9 digits.';
  if (account.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(account.ifscCode.trim())) {
    errors[`${prefix}ifscCode`] = 'Enter a valid 11-character IFSC code.';
  }
  return errors;
};
const emptyForm = () => ({
  bankCode: '', bankName: '', bankType: '', licenseNumber: '', pan: '', gstNumber: '', branchCount: '',
  addressType: '', pincode: '', address1: '', addressLine2: '', landmark: '', city: '', state: '',
  contactNumber: '', emailId: '',
  accounts: [], approvalAuthority: '',
  singlePartyLimit: '', groupExposureLimit: '', sanctionMargin: '', penaltyCharge: '', penaltyRate: ''
});

function validateStep(stepIndex, values) {
  const errors = {};
  const add = (field, message) => { errors[field] = message; };
  const required = (field, label, minLength = 1) => {
    const value = String(values[field] || '').trim();
    if (value.length < minLength) add(field, `${label} must be at least ${minLength} characters.`);
  };
  const validAmount = (field, label, max = Number.MAX_SAFE_INTEGER) => {
    const value = String(values[field] || '').trim();
    if (value && (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > max)) {
      add(field, `${label} must be a non-negative amount${max < Number.MAX_SAFE_INTEGER ? ` not over ${max}` : ''}.`);
    }
  };

  if (stepIndex === 0) {
    required('bankCode', 'Bank code', 2);
    if (values.bankCode.trim() && !/^[A-Z0-9][A-Z0-9-]{1,19}$/i.test(values.bankCode.trim())) {
      add('bankCode', 'Use 2–20 letters, numbers, or hyphens.');
    }
    required('bankName', 'Bank name', 2);
    if (values.bankName.trim().length > 120) add('bankName', 'Bank name cannot exceed 120 characters.');
    required('bankType', 'Bank type', 2);
    if (values.licenseNumber.trim() && !/^[A-Z0-9/-]{3,30}$/i.test(values.licenseNumber.trim())) {
      add('licenseNumber', 'Use 3–30 letters, numbers, /, or hyphens.');
    }
    if (values.pan.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(values.pan.trim())) add('pan', 'Enter a valid 10-character PAN.');
    if (values.gstNumber.trim() && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(values.gstNumber.trim())) {
      add('gstNumber', 'Enter a valid 15-character GSTIN.');
    }
    if (values.branchCount && (!/^\d+$/.test(values.branchCount) || Number(values.branchCount) < 1 || Number(values.branchCount) > 100000)) {
      add('branchCount', 'Enter a whole number between 1 and 100,000.');
    }
  }

  if (stepIndex === 1) {
    if (values.pincode.trim() && !/^\d{6}$/.test(values.pincode.trim())) {
      add('pincode', 'PIN code must contain 6 digits.');
    }
    if (values.contactNumber.trim() && !/^\d{10}$/.test(values.contactNumber.trim())) {
      add('contactNumber', 'Contact number must contain 10 digits.');
    }
    if (values.emailId.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.emailId.trim())) {
      add('emailId', 'Enter a valid email address.');
    }
  }

  if (stepIndex === 2) {
    values.accounts.forEach((account, index) => {
      Object.assign(errors, validateAccount(account, `account-${index}-`));
    });
  }

  if (stepIndex === 3) {
    validAmount('singlePartyLimit', 'Single party limit');
    validAmount('groupExposureLimit', 'Group exposure limit');
    validAmount('penaltyCharge', 'Penalty charge');
    for (const field of ['sanctionMargin', 'penaltyRate']) {
      const value = String(values[field] || '').trim();
      if (value && (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 100)) {
        add(field, `${field === 'sanctionMargin' ? 'Sanction margin' : 'Penalty rate'} must be between 0 and 100.`);
      }
    }
  }
  return errors;
}

function TextField({ label, field, value, onChange, error, hint, required = false, type = 'text', className = '', ...props }) {
  const errorId = `bank-master-${field}-error`;
  return (
    <label className={`bank-master-field ${className}`.trim()}>
      <span>{label}{required && <em aria-hidden="true"> *</em>}</span>
      <input
        id={`bank-master-${field}`}
        name={field}
        type={type}
        value={value}
        onChange={onChange}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {hint && <small className="bank-master-field-hint">{hint}</small>}
      {error && <small className="bank-master-field-error" id={errorId}>{error}</small>}
    </label>
  );
}

function LookupSelectField({ label, field, value, options, onChange, error, loading, required = false }) {
  const errorId = `bank-master-${field}-error`;
  return (
    <label className="bank-master-field">
      <span>{label}{required && <em aria-hidden="true"> *</em>}</span>
      <select
        id={`bank-master-${field}`}
        name={field}
        value={value}
        onChange={onChange}
        required={required}
        aria-required={required}
        disabled={loading || options.length === 0}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      >
        <option value="">{loading ? 'Loading options…' : `Select ${label}`}</option>
        {options.map((option) => (
          <option key={option.id} value={option.name}>{option.name}</option>
        ))}
      </select>
      {error && <small className="bank-master-field-error" id={errorId}>{error}</small>}
    </label>
  );
}

export default function BankMaster() {
  const [form, setForm] = useState(emptyForm);
  const [originalForm, setOriginalForm] = useState(emptyForm);
  const [activeStep, setActiveStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [accountDraft, setAccountDraft] = useState(emptyAccount);
  const [editingAccountIndex, setEditingAccountIndex] = useState(null);
  const [accountEntryOpen, setAccountEntryOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [lookupOptions, setLookupOptions] = useState({});
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [lookupError, setLookupError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadBankMasterLookups() {
      setLookupsLoading(true);
      setLookupError('');
      try {
        const lookupTypes = (await getLookupTypes(controller.signal))
          .filter((lookup) => lookup.status === 'Active');
        const entries = await Promise.all(bankMasterLookups.map(async ({ field, label }) => {
          const lookup = lookupTypes.find(
            (item) => normalizeLookupName(item.name) === normalizeLookupName(label)
          );
          if (!lookup?.code) {
            throw new Error(`No active lookup type found for ${label}.`);
          }

          const options = (await getLookupOptions(lookup.code, controller.signal))
            .filter((option) => option.status === 'Active' && (option.name || option.code))
            .sort((first, second) => first.displayOrder - second.displayOrder)
            .map((option) => ({
              id: option.id,
              name: option.name || option.code
            }));
          if (!options.length) {
            throw new Error(`The active ${label} lookup has no options.`);
          }
          return [field, options];
        }));

        if (!controller.signal.aborted) {
          setLookupOptions(Object.fromEntries(entries));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLookupError(error instanceof Error ? error.message : 'Unable to load Bank Master lookup options.');
        }
      } finally {
        if (!controller.signal.aborted) setLookupsLoading(false);
      }
    }

    loadBankMasterLookups();
    return () => controller.abort();
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setNotice('');
  }

  function updateAccountDraft(field, value) {
    setAccountDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, accountDraft: '', [`account-draft-${field}`]: '' }));
    setNotice('');
  }

  function addAccount() {
    const accountErrors = validateAccount(accountDraft);
    setErrors(accountErrors);
    const firstInvalidField = Object.keys(accountErrors)[0];
    if (firstInvalidField) {
      document.getElementById(`bank-master-${firstInvalidField}`)?.focus();
      return;
    }
    const account = {
      ...accountDraft,
      particulars: accountDraft.particulars.trim(),
      bankName: accountDraft.bankName.trim(),
      accountType: accountDraft.accountType.trim(),
      accountNumber: accountDraft.accountNumber.trim(),
      micrCode: accountDraft.micrCode.trim(),
      ifscCode: accountDraft.ifscCode.trim().toUpperCase()
    };
    setForm((current) => ({
      ...current,
      accounts: editingAccountIndex === null
        ? [...current.accounts, account]
        : current.accounts.map((savedAccount, index) => index === editingAccountIndex ? account : savedAccount)
    }));
    setAccountDraft(emptyAccount());
    setEditingAccountIndex(null);
    setAccountEntryOpen(false);
    setErrors({});
    setNotice('');
  }

  function editAccount(index) {
    setAccountDraft({ ...form.accounts[index] });
    setEditingAccountIndex(index);
    setAccountEntryOpen(true);
    setErrors({});
    setNotice('');
  }

  function closeAccountEntry() {
    setAccountDraft(emptyAccount());
    setEditingAccountIndex(null);
    setAccountEntryOpen(false);
    setErrors({});
    setNotice('');
  }

  function removeAccount(index) {
    setForm((current) => ({ ...current, accounts: current.accounts.filter((_, accountIndex) => accountIndex !== index) }));
    if (editingAccountIndex === index) {
      setAccountDraft(emptyAccount());
      setEditingAccountIndex(null);
    } else if (editingAccountIndex !== null && editingAccountIndex > index) {
      setEditingAccountIndex((current) => current - 1);
    }
    setErrors({});
    setNotice('');
  }

  function validateCurrentStep() {
    if (activeStep === 2 && (editingAccountIndex !== null || Object.values(accountDraft).some((value) => String(value).trim()))) {
      setErrors({ accountDraft: 'Add or update this account, or cancel the edit before continuing.' });
      return false;
    }
    const nextErrors = validateStep(activeStep, form);
    setErrors(nextErrors);
    const firstInvalidField = Object.keys(nextErrors)[0];
    if (firstInvalidField) {
      const invalidAccount = firstInvalidField.match(/^account-(\d+)-(.+)$/);
      if (invalidAccount) {
        const index = Number(invalidAccount[1]);
        editAccount(index);
        window.setTimeout(() => document.getElementById(`bank-master-account-draft-${invalidAccount[2]}`)?.focus(), 0);
        return false;
      }
      const input = document.getElementById(`bank-master-${firstInvalidField}`);
      input?.focus();
      return false;
    }
    return true;
  }

  function goNext() {
    if (!validateCurrentStep()) return;
    setActiveStep((current) => Math.min(current + 1, steps.length - 1));
    setErrors({});
  }

  function continueAfterAccountDraft() {
    if (!validateCurrentStep()) return;
    setOriginalForm({ ...form, accounts: form.accounts.map((account) => ({ ...account })) });
    setNotice('Account details are held in this page only and have not been saved to a backend.');
    setErrors({});
    setActiveStep(3);
  }

  function cancelChanges() {
    if (originalForm) setForm({ ...originalForm, accounts: originalForm.accounts.map((account) => ({ ...account })) });
    setAccountDraft(emptyAccount());
    setEditingAccountIndex(null);
    setAccountEntryOpen(false);
    setErrors({});
    setActiveStep(0);
    setNotice('Draft changes discarded.');
  }

  function submitForm(event) {
    event.preventDefault();
    const allErrors = steps.reduce((collected, _step, index) => ({ ...collected, ...validateStep(index, form) }), {});
    setErrors(allErrors);
    const firstInvalidField = Object.keys(allErrors)[0];
    if (firstInvalidField) {
      const addressFields = ['addressType', 'pincode', 'address', 'addressLine2', 'landmark', 'city', 'state', 'contactNumber', 'emailId'];
      const limitFields = ['singlePartyLimit', 'groupExposureLimit', 'sanctionMargin', 'penaltyCharge', 'penaltyRate'];
      const stepIndex = firstInvalidField.startsWith('account-')
        ? 2
        : limitFields.includes(firstInvalidField)
          ? 3
          : addressFields.includes(firstInvalidField)
            ? 1
            : 0;
      setActiveStep(stepIndex);
      const invalidAccount = firstInvalidField.match(/^account-(\d+)-(.+)$/);
      if (invalidAccount) {
        const index = Number(invalidAccount[1]);
        setAccountDraft({ ...form.accounts[index] });
        setEditingAccountIndex(index);
        setAccountEntryOpen(true);
        window.setTimeout(() => document.getElementById(`bank-master-account-draft-${invalidAccount[2]}`)?.focus(), 0);
      } else {
        window.setTimeout(() => document.getElementById(`bank-master-${firstInvalidField}`)?.focus(), 0);
      }
      return;
    }

    setOriginalForm({ ...form, accounts: form.accounts.map((account) => ({ ...account })) });
    setNotice('Draft updated for this page only. No backend is connected, so these changes are not persisted.');
    setActiveStep(0);
  }

  const currentStep = steps[activeStep];
  const StepIcon = currentStep.icon;
  return (
    <AppShell title="">
      <div className="bank-master-page">
        <div className="bank-master-content">
          <PageHeader
            eyebrow="Administration"
            title="Bank Master"
            description="Manage organization bank details and account limits."
            marquee
          />
          <p className="bank-master-local-mode" role="note">
            Bank details are not connected to a save API. Lookup options load from the lookup service.
          </p>
          {lookupsLoading && <p className="bank-master-local-mode" role="status">Loading Bank Master lookup options…</p>}
          {lookupError && <p className="bank-master-field-error" role="alert">{lookupError}</p>}
          {notice && <p className="bank-master-success" role="status"><Check size={16} />{notice}</p>}

          <section className="bank-master-card" aria-label="Bank master editor">
            <form onSubmit={submitForm} noValidate>
              <div className="bank-master-layout">
                <nav className="bank-master-steps" aria-label="Bank details sections">
                  {steps.map(({ id, label, icon: Icon }, index) => (
                    <button
                      className={`bank-master-step${activeStep === index ? ' active' : ''}${activeStep > index ? ' visited' : ''}`}
                      type="button"
                      key={id}
                      aria-current={activeStep === index ? 'step' : undefined}
                      onClick={() => index < activeStep && setActiveStep(index)}
                      disabled={index > activeStep}
                    >
                      <span className="bank-master-step-icon"><Icon size={17} /></span>
                      <span>{label}</span>
                      {activeStep > index && <Check className="bank-master-step-check" size={15} />}
                    </button>
                  ))}
                </nav>

                <div className={`bank-master-panel${activeStep === 1 ? ' bank-master-panel-address' : ''}`} key={currentStep.id}>
                  <header className="bank-master-panel-heading">
                    <span className="bank-master-panel-icon"><StepIcon size={19} /></span>
                    <div>
                      <span>STEP {activeStep + 1} OF {steps.length}</span>
                      <h2>{currentStep.label}</h2>
                    </div>
                  </header>

                  {activeStep === 0 && (
                    <div className="bank-master-fields">
                      {[
                        ['Bank Code', 'bankCode', 20],
                        ['Bank Name', 'bankName', 120],
                        ['Bank Type', 'bankType', 80],
                        ['Registration License No.', 'licenseNumber', 30],
                        ['PAN No.', 'pan', 10],
                        ['G.S.T. No.', 'gstNumber', 15],
                        ['No. of Branches', 'branchCount', 6]
                      ].map(([label, field, maxLength]) => (
                        <TextField
                          key={field}
                          label={label}
                          field={field}
                          value={form[field]}
                          maxLength={maxLength}
                          required={['bankCode', 'bankName', 'bankType'].includes(field)}
                          error={errors[field]}
                          onChange={(event) => updateField(field, event.target.value)}
                        />
                      ))}
                    </div>
                  )}

                  {activeStep === 1 && (
                    <div className="bank-master-fields bank-master-address-fields">
                      <LookupSelectField
                        label="Address Type"
                        field="addressType"
                        value={form.addressType}
                        options={lookupOptions.addressType || []}
                        loading={lookupsLoading}
                        error={errors.addressType}
                        onChange={(event) => updateField('addressType', event.target.value)}
                      />
                      <TextField
                        label="Address1"
                        field="address"
                        value={form.address}
                        maxLength={200}
                        className="bank-master-field-full"
                        error={errors.address}
                        onChange={(event) => updateField('address', event.target.value)}
                      />
                      <TextField
                        label="Address2"
                        field="addressLine2"
                        value={form.addressLine2}
                        maxLength={200}
                        className="bank-master-field-full"
                        error={errors.addressLine2}
                        onChange={(event) => updateField('addressLine2', event.target.value)}
                      />
                      <TextField
                        label="Landmark"
                        field="landmark"
                        value={form.landmark}
                        maxLength={120}
                        error={errors.landmark}
                        onChange={(event) => updateField('landmark', event.target.value)}
                      />
                      <TextField
                        label="City"
                        field="city"
                        value={form.city}
                        maxLength={100}
                        error={errors.city}
                        onChange={(event) => updateField('city', event.target.value)}
                      />
                      <TextField
                        label="State "
                        field="state"
                        value={form.state}
                        maxLength={100}
                        error={errors.state}
                        onChange={(event) => updateField('state', event.target.value)}
                      />
                      <TextField
                        label="Pincode"
                        field="pincode"
                        value={form.pincode}
                        maxLength={6}
                        inputMode="numeric"
                        error={errors.pincode}
                        onChange={(event) => updateField('pincode', event.target.value.replace(/\D/g, ''))}
                      />
                      <TextField
                        label="Contact"
                        field="contactNumber"
                        value={form.contactNumber}
                        maxLength={10}
                        type="tel"
                        inputMode="numeric"
                        error={errors.contactNumber}
                        onChange={(event) => updateField('contactNumber', event.target.value.replace(/\D/g, ''))}
                      />
                      <TextField
                        label="Email ID"
                        field="emailId"
                        value={form.emailId}
                        maxLength={120}
                        type="email"
                        error={errors.emailId}
                        onChange={(event) => updateField('emailId', event.target.value)}
                      />
                    </div>
                  )}

                  {activeStep === 2 && (
                    <div className="bank-master-accounts">
                      <div className="bank-master-table-heading">
                        <div><h3>Other Bank Details</h3><p>Add one or more bank accounts. Added accounts appear in the grid below.</p></div>
                        {!accountEntryOpen && (
                          <button className="bank-master-add-row" type="button" onClick={() => setAccountEntryOpen(true)}>
                            Add account
                          </button>
                        )}
                      </div>
                      {accountEntryOpen && (
                        <section className="bank-master-account-entry" aria-label="Add bank account">
                          <h4>{editingAccountIndex === null ? 'New account' : `Edit account ${editingAccountIndex + 1}`}</h4>
                          <div className="bank-master-account-fields">
                            <LookupSelectField
                              label="Particulars"
                              field="account-draft-particulars"
                              value={accountDraft.particulars}
                              options={lookupOptions.particulars || []}
                              loading={lookupsLoading}
                              error={errors['account-draft-particulars']}
                              onChange={(event) => updateAccountDraft('particulars', event.target.value)}
                            />
                            <LookupSelectField
                              label="Account Type"
                              field="account-draft-accountType"
                              value={accountDraft.accountType}
                              options={lookupOptions.accountType || []}
                              loading={lookupsLoading}
                              required
                              error={errors['account-draft-accountType']}
                              onChange={(event) => updateAccountDraft('accountType', event.target.value)}
                            />
                            {[
                              ['bankName', 'Bank Name', 120],
                              ['accountNumber', 'Account Number', 34],
                              ['micrCode', 'MICR Code', 9],
                              ['ifscCode', 'IFSC Code', 11]
                            ].map(([field, label, maxLength]) => {
                              const errorKey = `account-draft-${field}`;
                              return (
                                <TextField
                                  key={field}
                                  label={label}
                                  field={errorKey}
                                  value={accountDraft[field]}
                                  maxLength={maxLength}
                                  required
                                  inputMode={field === 'micrCode' ? 'numeric' : undefined}
                                  autoCapitalize={field === 'ifscCode' || field === 'micrCode' ? 'characters' : undefined}
                                  error={errors[errorKey]}
                                  onChange={(event) => updateAccountDraft(field, ['ifscCode', 'micrCode'].includes(field) ? event.target.value.toUpperCase() : event.target.value)}
                                />
                              );
                            })}
                          </div>
                          <div className="bank-master-account-entry-actions">
                            <button className="bank-master-add-row" type="button" onClick={addAccount}>
                              {editingAccountIndex === null ? 'Add account' : 'Update account'}
                            </button>
                            <button className="bank-master-account-cancel-edit" type="button" onClick={closeAccountEntry}>
                              {editingAccountIndex === null ? 'Cancel' : 'Cancel edit'}
                            </button>
                          </div>
                          {errors.accountDraft && <small className="bank-master-field-error" role="alert">{errors.accountDraft}</small>}
                        </section>
                      )}
                      <div className="bank-master-account-table-wrap">
                        <table className="bank-master-account-table">
                          <thead><tr><th>Particulars</th><th>Bank Name</th><th>Account Type</th><th>Account No.</th><th>MICR Code</th><th>IFSC Code</th><th>Actions</th></tr></thead>
                          <tbody>
                            {form.accounts.map((account, index) => (
                              <tr key={`${account.accountNumber}-${index}`}>
                                <td>{account.particulars || '—'}</td>
                                <td>{account.bankName}</td>
                                <td>{account.accountType}</td>
                                <td>{account.accountNumber}</td>
                                <td>{account.micrCode}</td>
                                <td>{account.ifscCode}</td>
                                <td className="bank-master-account-actions">
                                  <button type="button" onClick={() => editAccount(index)}>Edit</button>
                                  <button type="button" onClick={() => removeAccount(index)}>Remove</button>
                                </td>
                              </tr>
                            ))}
                            {form.accounts.length === 0 && (
                              <tr>
                                <td className="bank-master-account-empty-cell" colSpan="7">
                                  No accounts added yet. Select Add account to create the first row.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeStep === 3 && (
                    <div className="bank-master-fields">
                      <LookupSelectField
                        label="Loan Approval Authority"
                        field="approvalAuthority"
                        value={form.approvalAuthority}
                        options={lookupOptions.approvalAuthority || []}
                        loading={lookupsLoading}
                        error={errors.approvalAuthority}
                        onChange={(event) => updateField('approvalAuthority', event.target.value)}
                      />
                      <TextField label="Single Party Limit" field="singlePartyLimit" value={form.singlePartyLimit} onChange={(event) => updateField('singlePartyLimit', event.target.value)} error={errors.singlePartyLimit} type="number" min="0" step="0.01" inputMode="decimal" />
                      <TextField label="Group Exposure Limit" field="groupExposureLimit" value={form.groupExposureLimit} onChange={(event) => updateField('groupExposureLimit', event.target.value)} error={errors.groupExposureLimit} type="number" min="0" step="0.01" inputMode="decimal" />
                      <TextField label="Sanction Margin %" field="sanctionMargin" value={form.sanctionMargin} onChange={(event) => updateField('sanctionMargin', event.target.value)} error={errors.sanctionMargin} type="number" min="0" max="100" step="0.01" inputMode="decimal" />
                      <TextField label="Penalty Charge" field="penaltyCharge" value={form.penaltyCharge} onChange={(event) => updateField('penaltyCharge', event.target.value)} error={errors.penaltyCharge} type="number" min="0" step="0.01" inputMode="decimal" />
                      <TextField label="Penalty Rate %" field="penaltyRate" value={form.penaltyRate} onChange={(event) => updateField('penaltyRate', event.target.value)} error={errors.penaltyRate} type="number" min="0" max="100" step="0.01" inputMode="decimal" />
                    </div>
                  )}

                  <footer className="bank-master-actions">
                    <button className="bank-master-cancel" type="button" onClick={cancelChanges}><RotateCcw size={16} /> Cancel</button>
                    <div>
                      {activeStep > 0 && <button className="bank-master-previous" type="button" onClick={() => { setActiveStep((step) => step - 1); setErrors({}); }}><ChevronLeft size={17} /> Previous</button>}
                      {activeStep < steps.length - 1 ? (
                        <button className="bank-master-next" type="button" onClick={activeStep === 2 ? continueAfterAccountDraft : goNext}>
                          Next <ChevronRight size={17} />
                        </button>
                      ) : (
                        <button className="bank-master-next" type="submit"><Save size={16} /> Save draft</button>
                      )}
                    </div>
                  </footer>
                </div>
              </div>
            </form>
          </section>
        </div>
      </div>
    </AppShell>
  );
}