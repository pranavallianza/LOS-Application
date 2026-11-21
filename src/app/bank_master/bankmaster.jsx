'use client';

import { useState } from 'react';
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

const steps = [
  { id: 'bank', label: 'Bank Info', icon: Building2 },
  { id: 'address', label: 'Address Details', icon: MapPin },
  { id: 'accounts', label: 'Account Details', icon: Landmark },
  { id: 'limits', label: 'Limit Details', icon: SlidersHorizontal }
];

const emptyAccount = () => ({ particulars: '', bankName: '', accountType: '', accountNumber: '', micrCode: '', ifscCode: '' });
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
  addressType: '', pincode: '', address: '', addressLine2: '', landmark: '', city: '', state: '',
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

function TextField({ label, field, value, onChange, error, hint, required = false, type = 'text', ...props }) {
  const errorId = `bank-master-${field}-error`;
  return (
    <label className="bank-master-field">
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

export default function BankMaster() {
  const [form, setForm] = useState(emptyForm);
  const [originalForm, setOriginalForm] = useState(emptyForm);
  const [activeStep, setActiveStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [accountDraft, setAccountDraft] = useState(emptyAccount);
  const [editingAccountIndex, setEditingAccountIndex] = useState(null);
  const [notice, setNotice] = useState('');

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
    setErrors({});
    setNotice('');
  }

  function editAccount(index) {
    setAccountDraft({ ...form.accounts[index] });
    setEditingAccountIndex(index);
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
      const stepIndex = firstInvalidField.startsWith('account-') ? 2 : ['singlePartyLimit', 'groupExposureLimit', 'sanctionMargin', 'penaltyCharge', 'penaltyRate'].includes(firstInvalidField) ? 3 : 0;
      setActiveStep(stepIndex);
      const invalidAccount = firstInvalidField.match(/^account-(\d+)-(.+)$/);
      if (invalidAccount) {
        const index = Number(invalidAccount[1]);
        setAccountDraft({ ...form.accounts[index] });
        setEditingAccountIndex(index);
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
        <PageHeader
          eyebrow="Administration"
          title="Bank Master"
          description="Manage organization bank details and account limits."
          marquee
        />
        <p className="bank-master-local-mode" role="note">
          Backend access is disconnected. Draft changes stay on this page and are not persisted.
        </p>
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

                <div className="bank-master-panel" key={currentStep.id}>
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
                    <div className="bank-master-fields">
                      {[
                        ['Address Type', 'addressType', 60],
                        ['Pincode', 'pincode', 10],
                        ['Address', 'address', 200],
                        ['Address 2', 'addressLine2', 200],
                        ['Landmark', 'landmark', 120],
                        ['City', 'city', 100],
                        ['State / Union Territory', 'state', 100]
                      ].map(([label, field, maxLength]) => (
                        <TextField
                          key={field}
                          label={label}
                          field={field}
                          value={form[field]}
                          maxLength={maxLength}
                          error={errors[field]}
                          onChange={(event) => updateField(field, event.target.value)}
                        />
                      ))}
                    </div>
                  )}

                  {activeStep === 2 && (
                    <div className="bank-master-accounts">
                      <div className="bank-master-table-heading">
                        <div><h3>Bank Account Details</h3><p>Add accounts one at a time. Added accounts appear in this draft below.</p></div>
                      </div>
                      <section className="bank-master-account-entry" aria-label="Add bank account">
                        <h4>{editingAccountIndex === null ? 'New account' : `Edit account ${editingAccountIndex + 1}`}</h4>
                        <div className="bank-master-account-fields">
                          {[
                            ['particulars', 'Particulars', 120],
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
                                required={field !== 'particulars'}
                                inputMode={field === 'micrCode' ? 'numeric' : undefined}
                                autoCapitalize={field === 'ifscCode' || field === 'micrCode' ? 'characters' : undefined}
                                error={errors[errorKey]}
                                onChange={(event) => updateAccountDraft(field, ['ifscCode', 'micrCode'].includes(field) ? event.target.value.toUpperCase() : event.target.value)}
                              />
                            );
                          })}
                          <TextField
                            label="Account Type"
                            field="account-draft-accountType"
                            value={accountDraft.accountType}
                            required
                            error={errors['account-draft-accountType']}
                            onChange={(event) => updateAccountDraft('accountType', event.target.value)}
                          />
                        </div>
                        <div className="bank-master-account-entry-actions">
                          <button className="bank-master-add-row" type="button" onClick={addAccount}>
                            {editingAccountIndex === null ? 'Add account' : 'Update account'}
                          </button>
                          {editingAccountIndex !== null && (
                            <button className="bank-master-account-cancel-edit" type="button" onClick={() => {
                              setAccountDraft(emptyAccount());
                              setEditingAccountIndex(null);
                              setErrors({});
                            }}>Cancel edit</button>
                          )}
                        </div>
                        {errors.accountDraft && <small className="bank-master-field-error" role="alert">{errors.accountDraft}</small>}
                      </section>
                      {form.accounts.length ? (
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
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bank-master-account-empty">
                          <Landmark size={22} />
                          <strong>No bank accounts added</strong>
                          <span>Add an account above to include it in this draft.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {activeStep === 3 && (
                    <div className="bank-master-fields">
                      <TextField label="Loan Approval Authority" field="approvalAuthority" value={form.approvalAuthority} onChange={(event) => updateField('approvalAuthority', event.target.value)} />
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
    </AppShell>
  );
}