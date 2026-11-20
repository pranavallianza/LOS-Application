'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  Building2,
  Calendar,
  CreditCard,
  FileCheck,
  FileText,
  Home,
  Landmark,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  UserCheck,
  UserRound,
  UsersRound,
  Wallet,
} from 'lucide-react';
import AppShell from './AppShell';
import Card from './Card';
import { api } from '../services/api.js';
import { readCustomerRecords } from '../services/customerStorage';

const PROFILE_TABS = [
  { id: 'personal', label: 'Personal Details', icon: User },
  { id: 'address', label: 'Address Details', icon: Home },
  { id: 'employment', label: 'Employment info', icon: Briefcase },
  { id: 'income', label: 'Income Details', icon: Wallet },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'loan', label: 'Loan History', icon: Landmark },
  { id: 'references', label: 'Reference', icon: UsersRound },
];

function formatDisplayCustomerName(customer) {
  if (!customer) return 'Customer Profile';
  const form = customer.onboardingForm || {};
  let title = form.title || customer.title || '';
  let firstName = form.fullName || customer.firstName || '';
  let lastName = form.lastName || customer.lastName || '';

  if (!firstName && customer.name) {
    const parts = customer.name.trim().split(/\s+/);
    if (/^(mr|mrs|ms|dr|miss|shri|smt)\.?$/i.test(parts[0])) {
      title = title || parts[0];
      firstName = parts[1] || '';
      lastName = parts.slice(2).join(' ') || '';
    } else {
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
  }

  const cleanTitle = title.replace(/\.$/, '');
  const nameDisplay = [cleanTitle, firstName, lastName].filter(Boolean).join(' ');
  return nameDisplay || customer.name || '';
}

function getCustomerForm(customer) {
  const savedForm = customer.onboardingForm && typeof customer.onboardingForm === 'object'
    ? customer.onboardingForm
    : {};
  const [firstName, ...lastNameParts] = String(customer.name || '').trim().split(/\s+/);

  return {
    ...savedForm,
    leadId: savedForm.leadId || customer.leadId || '',
    panCard: savedForm.panCard || customer.panCard || '',
    branch: savedForm.branch || customer.branch || '',
    title: savedForm.title || customer.title || '',
    fullName: savedForm.fullName || firstName || '',
    middleName: savedForm.middleName || '',
    lastName: savedForm.lastName || lastNameParts.join(' ') || '',
    dob: savedForm.dob || '',
    age: savedForm.age || '',
    fatherName: savedForm.fatherName || [savedForm.fatherFirstName, savedForm.fatherMiddleName, savedForm.fatherLastName].filter(Boolean).join(' '),
    motherName: savedForm.motherName || [savedForm.motherFirstName, savedForm.motherMiddleName, savedForm.motherLastName].filter(Boolean).join(' '),
    email: savedForm.email || customer.email || '',
    customerType: savedForm.customerType || customer.type || '',
    kycStatus: savedForm.kycStatus || customer.kyc || '',
    aadhaarNumber: savedForm.aadhaarNumber || customer.aadhaarNumber || '',
    gender: savedForm.gender || '',
    kycRegn: savedForm.kycRegn || '',
    maritalStatus: savedForm.maritalStatus || '',
    mobileNo: savedForm.mobileNo || customer.phone || '',
    alternateContact: savedForm.alternateContact || '',
    occupation: savedForm.occupation || '',
    residentialStatus: savedForm.residentialStatus || '',
    residentialType: savedForm.residentialType || '',
    flatBuildingName: savedForm.flatBuildingName || '',
    streetRoad: savedForm.streetRoad || '',
    landMark: savedForm.landMark || '',
    city: savedForm.city || '',
    state: savedForm.state || '',
    pinCode: savedForm.pinCode || '',
    employmentType: savedForm.employmentType || '',
    employerType: savedForm.employerType || '',
    loanCategory: savedForm.loanCategory || '',
    designation: savedForm.designation || '',
    employerName: savedForm.employerName || '',
    dateOfJoining: savedForm.dateOfJoining || '',
    qualification: savedForm.qualification || '',
    empEmailId: savedForm.empEmailId || '',
    listedStatus: savedForm.listedStatus || '',
    yearsOfService: savedForm.yearsOfService || '',
    location: savedForm.location || '',
    dateOfRetirement: savedForm.dateOfRetirement || '',
    appointmentLetter: savedForm.appointmentLetter || null,
    annualIncome: savedForm.annualIncome || '',
    otherSourceIncome: savedForm.otherSourceIncome || '',
    totalGrossIncome: savedForm.totalGrossIncome || '',
    totalNetIncome: savedForm.totalNetIncome || '',
    incomeTax: savedForm.incomeTax || '',
    incomeTaxFilerStatus: savedForm.incomeTaxFilerStatus || '',
    bankName: savedForm.bankName || '',
    bankAccountNo: savedForm.bankAccountNo || '',
    bankAccountType: savedForm.bankAccountType || '',
    bankAccountStatus: savedForm.bankAccountStatus || '',
    riskCategory: savedForm.riskCategory || '',
    salaryCertificate: savedForm.salaryCertificate || null,
    formNo16: savedForm.formNo16 || null,
    documents: Array.isArray(savedForm.documents) ? savedForm.documents : [],
    taxReturns: Array.isArray(savedForm.taxReturns) ? savedForm.taxReturns : [],
    previousEmployment: Array.isArray(savedForm.previousEmployment)
      ? savedForm.previousEmployment.filter((row) => Object.values(row).some((value) => String(value ?? '').trim()))
      : [],
    loanHistory: Array.isArray(savedForm.loanHistory)
      ? savedForm.loanHistory.filter((loan) => Object.entries(loan).some(([key, value]) =>
        !['id', 'source'].includes(key) && String(value ?? '').trim()
      ))
      : [],
    references: Array.isArray(savedForm.references) ? savedForm.references : [],
  };
}

function displayValue(value, label = '') {
  if (value === undefined || value === null || String(value).trim() === '') return '';
  if (typeof value === 'object' && typeof value.name === 'string') return value.name;
  if (/date|joining|relieving|retirement|dob/i.test(label) && String(value).includes('-')) {
    const date = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    }
  }
  if (/income|outstanding|emi|amount|tds/i.test(label) && Number.isFinite(Number(String(value).replace(/[^\d.]/g, '')))) {
    const num = Number(String(value).replace(/[^\d.]/g, ''));
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return String(value);
}

function DetailCard({ label, value, isFile = false }) {
  const isPresentFile = isFile && value;

  return (
    <div className="view-detail-box">
      <span className="view-detail-label">{label}</span>
      <div className="view-detail-value-wrap">
        {isPresentFile ? (
          <span className="view-file-pill">
            <FileText size={14} className="view-file-icon" aria-hidden="true" />
            <span className="view-file-text">{typeof value === 'object' ? value.name : String(value)}</span>
          </span>
        ) : (
          <strong className="view-detail-value">{displayValue(value, label)}</strong>
        )}
      </div>
    </div>
  );
}

export default function CustomerProfileView({ customerId }) {
  const [customer, setCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const record = readCustomerRecords(api.customers).find((item) => item.id === customerId);
      if (!record) setLoadError('The selected customer could not be found.');
      else setCustomer(record);
    } catch (error) {
      setLoadError(error instanceof Error ? `Customer details could not be loaded: ${error.message}` : 'Customer details could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  const handleTabKeyDown = (event) => {
    const index = PROFILE_TABS.findIndex((tab) => tab.id === activeTab);
    let target = index;
    if (event.key === 'ArrowRight') target = (index + 1) % PROFILE_TABS.length;
    else if (event.key === 'ArrowLeft') target = (index - 1 + PROFILE_TABS.length) % PROFILE_TABS.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = PROFILE_TABS.length - 1;
    else return;

    event.preventDefault();
    setActiveTab(PROFILE_TABS[target].id);
    event.currentTarget.querySelectorAll('[role="tab"]')[target]?.focus();
  };

  const form = customer ? getCustomerForm(customer) : null;
  const customerName = customer ? formatDisplayCustomerName(customer) : 'Customer Profile';
  const customerPhone = customer?.phone || form?.mobileNo || '';
  const customerEmail = customer?.email || form?.email || '';
  const kycStatus = form?.kycStatus || customer?.kyc || '';
  const activeLoans = customer?.activeLoans ?? (form?.loanHistory?.length || 0);

  return (
    <AppShell title={`View Customer: ${customerId}`}>
      <div className="customer-view-page">
        {/* Top Header Row matching Edit with exact green back button */}
        <div className="customer-view-top-header">
          <div>
            <p className="customer-view-sub-id">
              <span>Customer ID: {customerId}</span>
              {kycStatus ? (
                <span className={`kyc-badge ${kycStatus === 'Verified' ? 'verified' : 'pending'}`}>
                  {kycStatus}
                </span>
              ) : null}
            </p>
          </div>
          <Link
            href="/customer_management"
            className="loan-back-button"
            style={{
              height: '32px',
              minWidth: 'auto',
              padding: '0 10px',
              gap: '5px',
              fontSize: '13px',
              background: '#368262',
              borderColor: '#368262',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              fontWeight: '600',
            }}
          >
            <ArrowLeft size={14} />
            Back
          </Link>
        </div>

        {isLoading || loadError ? (
          <Card className="customer-view-card customer-view-state">
            {isLoading ? <p>Loading customer details...</p> : <p role="alert">{loadError}</p>}
          </Card>
        ) : (
          <Card className="customer-view-card">
            {/* 6-Tile Summary Header Card */}
            <div className="customer-view-summary" aria-label="Customer profile summary">
              <div className="customer-view-summary-tile highlight">
                <span><UserRound size={14} aria-hidden="true" /> Customer Name</span>
                <strong>{customerName}</strong>
              </div>
              <div className="customer-view-summary-tile">
                <span><Phone size={14} aria-hidden="true" /> Phone Number</span>
                <strong>{customerPhone}</strong>
              </div>
              <div className="customer-view-summary-tile">
                <span><Mail size={14} aria-hidden="true" /> Email Address</span>
                <strong>{customerEmail}</strong>
              </div>
              <div className="customer-view-summary-tile">
                <span><UserCheck size={14} aria-hidden="true" /> Customer Type</span>
                <strong>{form?.customerType || customer?.type || ''}</strong>
              </div>
              <div className="customer-view-summary-tile">
                <span><Banknote size={14} aria-hidden="true" /> Active Loans</span>
                <strong>{activeLoans}</strong>
              </div>
            </div>

            {/* Stepper / Tab Navigation matching Edit & Add steps */}
            <nav
              className="customer-view-tabs"
              role="tablist"
              aria-label="Customer details sections"
              onKeyDown={handleTabKeyDown}
            >
              {PROFILE_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    className={`customer-view-tab ${isActive ? 'active' : ''}`}
                    id={`customer-view-tab-${tab.id}`}
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls="customer-view-tabpanel"
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon size={14} aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Tab Panel Content with Exact Fields of Edit & Add form */}
            <section
              className="customer-view-tabpanel"
              id="customer-view-tabpanel"
              role="tabpanel"
              aria-labelledby={`customer-view-tab-${activeTab}`}
              tabIndex={0}
            >
              {/* TAB 1: Personal Details (Step 0) */}
              {activeTab === 'personal' && (
                <div className="customer-view-sections-stack">
                  <div className="customer-view-section-card">
                    <div className="customer-view-section-header">
                      <h2>Applicant Details & Identity</h2>
                    </div>
                    <div className="customer-view-grid three-col">
                      <DetailCard label="Lead ID" value={form.leadId} />
                      <DetailCard label="PAN Card" value={form.panCard} />
                      <DetailCard label="Branch" value={form.branch} />
                    </div>
                  </div>

                  <div className="customer-view-section-card">
                    <div className="customer-view-section-header">
                      <h2>Applicant Name</h2>
                    </div>
                    <div className="customer-view-grid four-col">
                      <DetailCard label="Title" value={form.title} />
                      <DetailCard label="First Name" value={form.fullName} />
                      <DetailCard label="Middle Name" value={form.middleName} />
                      <DetailCard label="Last Name" value={form.lastName} />
                    </div>
                  </div>

                  <div className="customer-view-section-card">
                    <div className="customer-view-section-header">
                      <h2>Demographic & KYC Information</h2>
                    </div>
                    <div className="customer-view-grid three-col">
                      <DetailCard label="Date of Birth" value={form.dob} />
                      <DetailCard label="Age" value={form.age ? `${form.age} years` : ''} />
                      <DetailCard label="Father's / Husband's Name" value={form.fatherName} />
                      <DetailCard label="Father's / Husband's Title" value={form.fatherTitle} />
                      <DetailCard label="Father's / Husband's First Name" value={form.fatherFirstName} />
                      <DetailCard label="Father's / Husband's Middle Name" value={form.fatherMiddleName} />
                      <DetailCard label="Father's / Husband's Last Name" value={form.fatherLastName} />
                      <DetailCard label="Mother's Name" value={form.motherName} />
                      <DetailCard label="Mother's Title" value={form.motherTitle} />
                      <DetailCard label="Mother's First Name" value={form.motherFirstName} />
                      <DetailCard label="Mother's Middle Name" value={form.motherMiddleName} />
                      <DetailCard label="Mother's Last Name" value={form.motherLastName} />
                      <DetailCard
                        label="Spouse's Name"
                        value={[form.spouseFirstName, form.spouseMiddleName, form.spouseLastName].filter(Boolean).join(' ')}
                      />
                      <DetailCard label="Spouse's Title" value={form.spouseTitle} />
                      <DetailCard label="Spouse's First Name" value={form.spouseFirstName} />
                      <DetailCard label="Spouse's Middle Name" value={form.spouseMiddleName} />
                      <DetailCard label="Spouse's Last Name" value={form.spouseLastName} />
                      <DetailCard label="Email ID" value={form.email} />
                      <DetailCard label="Customer Type" value={form.customerType} />
                      <DetailCard label="KYC Status" value={form.kycStatus} />
                      <DetailCard label="Aadhaar Card" value={form.aadhaarNumber} />
                      <DetailCard label="CKYC Registration" value={form.kycRegn} />
                      <DetailCard label="Gender" value={form.gender} />
                      <DetailCard label="Mobile Number" value={form.mobileNo} />
                      <DetailCard label="Alternate Contact" value={form.alternateContact} />
                      <DetailCard label="Occupation" value={form.occupation} />
                      <DetailCard label="Marital Status" value={form.maritalStatus} />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Address Details (Step 1) */}
              {activeTab === 'address' && (
                <div className="customer-view-sections-stack">
                  <div className="customer-view-section-card">
                    <div className="customer-view-section-header">
                      <h2>Residential Details</h2>
                    </div>
                    <div className="customer-view-grid two-col">
                      <DetailCard label="Residential Status" value={form.residentialStatus} />
                      <DetailCard label="Residential Type" value={form.residentialType} />
                    </div>
                  </div>

                  <div className="customer-view-section-card">
                    <div className="customer-view-section-header">
                      <h2>Address Location</h2>
                    </div>
                    <div className="customer-view-grid three-col">
                      <DetailCard label="Flat / Building Name" value={form.flatBuildingName} />
                      <DetailCard label="Street / Road" value={form.streetRoad} />
                      <DetailCard label="Landmark" value={form.landMark} />
                      <DetailCard label="City" value={form.city} />
                      <DetailCard label="State" value={form.state} />
                      <DetailCard label="PIN Code" value={form.pinCode} />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Employment Info (Step 2) */}
              {activeTab === 'employment' && (
                <div className="customer-view-sections-stack">
                  <div className="customer-view-section-card">
                    <div className="customer-view-section-header">
                      <h2>Current Employment Information</h2>
                    </div>
                    <div className="customer-view-grid three-col">
                      <DetailCard label="Employment Type" value={form.employmentType} />
                      <DetailCard label="Employer Type" value={form.employerType} />
                      <DetailCard label="Loan Category" value={form.loanCategory} />
                      <DetailCard label="Designation / Nature of Business" value={form.designation} />
                      <DetailCard label="Employer / Business Name" value={form.employerName} />
                      <DetailCard label="Date of Joining / Business Start" value={form.dateOfJoining} />
                      <DetailCard label="Qualification" value={form.qualification} />
                      <DetailCard label="No. of Years of Service" value={form.yearsOfService} />
                      <DetailCard label="Listed Status" value={form.listedStatus} />
                      <DetailCard label="Employee / Business Email" value={form.empEmailId} />
                      <DetailCard label="Employer / Business Location" value={form.location} />
                      <DetailCard label="Date of Retirement" value={form.dateOfRetirement} />
                      <DetailCard label="Appointment Letter" value={form.appointmentLetter} isFile />
                    </div>
                  </div>

                  <div className="customer-view-section-card">
                    <div className="customer-view-section-header">
                      <h2>Previous Employment History</h2>
                    </div>
                    {form.previousEmployment && form.previousEmployment.length > 0 ? (
                      <div className="customer-view-table-wrap">
                        <table className="customer-view-table">
                          <thead>
                            <tr>
                              <th style={{ width: 45 }}>Sr.</th>
                              <th>Employment Type</th>
                              <th>Employer Name</th>
                              <th>Designation</th>
                              <th>Location</th>
                              <th>Date of Joining</th>
                              <th>Date of Relieving</th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.previousEmployment.map((row, index) => (
                              <tr key={index}>
                                <td className="row-sr">{index + 1}</td>
                                <td>{row.employmentType || ''}</td>
                                <td><strong>{row.employerName || ''}</strong></td>
                                <td>{row.designation || ''}</td>
                                <td>{row.location || ''}</td>
                                <td>{displayValue(row.dateOfJoining, 'Date')}</td>
                                <td>{displayValue(row.dateOfRelieving, 'Date')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="customer-view-empty">No previous employment records provided.</p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: Income Details (Step 3) */}
              {activeTab === 'income' && (
                <div className="customer-view-sections-stack">
                  <div className="customer-view-section-card">
                    <div className="customer-view-section-header">
                      <h2>Income & Banking Information</h2>
                    </div>
                    <div className="customer-view-grid three-col">
                      <DetailCard label="Annual Income" value={form.annualIncome} />
                      <DetailCard label="Other Source of Income" value={form.otherSourceIncome} />
                      <DetailCard label="Total Gross Income" value={form.totalGrossIncome} />
                      <DetailCard label="Total Net Income" value={form.totalNetIncome} />
                      <DetailCard label="Income Tax" value={form.incomeTax} />
                      <DetailCard label="Income Tax Filer Status" value={form.incomeTaxFilerStatus} />
                      <DetailCard label="Bank Name" value={form.bankName} />
                      <DetailCard label="Bank Account Number" value={form.bankAccountNo} />
                      <DetailCard label="A/C Type" value={form.bankAccountType} />
                      <DetailCard label="A/C Status" value={form.bankAccountStatus} />
                      <DetailCard label="Risk Category" value={form.riskCategory} />
                      <DetailCard label="Salary Certificate" value={form.salaryCertificate} isFile />
                      <DetailCard label="Form 16 Document" value={form.formNo16} isFile />
                    </div>
                  </div>

                  {form.incomeTaxFilerStatus === 'Filer' && (
                    <div className="customer-view-section-card">
                      <div className="customer-view-section-header">
                        <h2>Income Tax Filing Details</h2>
                      </div>
                      {form.taxReturns && form.taxReturns.length > 0 ? (
                        <div className="customer-view-table-wrap">
                          <table className="customer-view-table">
                            <thead>
                              <tr>
                                <th style={{ width: 45 }}>Sr.</th>
                                <th>Financial Year</th>
                                <th style={{ textAlign: 'right' }}>Gross Income</th>
                                <th style={{ textAlign: 'right' }}>TDS Paid</th>
                              </tr>
                            </thead>
                            <tbody>
                              {form.taxReturns.map((tax, index) => (
                                <tr key={index}>
                                  <td className="row-sr">{index + 1}</td>
                                  <td><strong>{tax.financialYear || ''}</strong></td>
                                  <td style={{ textAlign: 'right' }}>{displayValue(tax.grossIncome, 'income')}</td>
                                  <td style={{ textAlign: 'right' }}>{displayValue(tax.tdsPaid, 'tds')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="customer-view-empty">No income tax filing details provided.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: Documents (Step 4) */}
              {activeTab === 'documents' && (
                <div className="customer-view-section-card">
                  <div className="customer-view-section-header">
                    <h2>Customer Uploaded Documents</h2>
                  </div>
                  {form.documents && form.documents.length > 0 ? (
                    <div className="customer-view-table-wrap">
                      <table className="customer-view-table">
                        <thead>
                          <tr>
                            <th style={{ width: 45 }}>Sr.</th>
                            <th>Document Name</th>
                            <th>Uploaded File</th>
                            <th>Expiry Date</th>
                            <th>Remarks / Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.documents.map((doc, index) => (
                            <tr key={index}>
                              <td className="row-sr">{index + 1}</td>
                              <td><strong>{doc.name || ''}</strong></td>
                              <td>
                                {doc.file ? (
                                  <span className="view-file-pill">
                                    <FileText size={13} className="view-file-icon" aria-hidden="true" />
                                    <span>{typeof doc.file === 'object' ? doc.file.name : String(doc.file)}</span>
                                  </span>
                                ) : (
                                  <span style={{ color: '#90a4a8', fontSize: '12px' }} />
                                )}
                              </td>
                              <td>{doc.expiryDate || ''}</td>
                              <td>
                                <span className="view-doc-status-pill">
                                  {doc.remarks || 'Verified'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="customer-view-empty">No customer documents provided.</p>
                  )}
                </div>
              )}

              {/* TAB 6: Loan Details (Step 5) */}
              {activeTab === 'loan' && (
                <div className="customer-view-section-card">
                  <div className="customer-view-section-header">
                    <h2>Loan History & Existing Credit Facilities</h2>
                  </div>
                  {form.loanHistory && form.loanHistory.length > 0 ? (
                    <div className="customer-view-table-wrap">
                      <table className="customer-view-table">
                        <thead>
                          <tr>
                            <th style={{ width: 45 }}>Sr.</th>
                            <th>Bank Name</th>
                            <th>Account Number</th>
                            <th>Type of Loan</th>
                            <th style={{ textAlign: 'right' }}>Total Outstanding</th>
                            <th style={{ textAlign: 'right' }}>Monthly EMI</th>
                            <th>Expiry Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.loanHistory.map((loan, index) => (
                            <tr key={index}>
                              <td className="row-sr">{index + 1}</td>
                              <td><strong>{loan.bankName || ''}</strong></td>
                              <td>{loan.accountNumber || ''}</td>
                              <td>{loan.loanType || ''}</td>
                              <td style={{ textAlign: 'right' }}>{displayValue(loan.totalOutstanding, 'outstanding')}</td>
                              <td style={{ textAlign: 'right' }}>{displayValue(loan.emi, 'emi')}</td>
                              <td>{displayValue(loan.expiryDate, 'date')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="customer-view-empty">No loan history records provided for this customer.</p>
                  )}
                </div>
              )}

              {activeTab === 'references' && (
                <div className="customer-view-section-card">
                  <div className="customer-view-section-header">
                    <h2>References</h2>
                    <p>References provided for future contact.</p>
                  </div>
                  {form.references && form.references.length > 0 ? (
                    <div className="customer-view-table-wrap">
                      <table className="customer-view-table">
                        <thead>
                          <tr>
                            <th style={{ width: 45 }}>Sr.</th>
                            <th>Name of the Reference</th>
                            <th>Relation</th>
                            <th>Location</th>
                            <th>Contact No.</th>
                            <th>Email ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.references.map((reference, index) => (
                            <tr key={`reference-${index}`}>
                              <td className="row-sr">{index + 1}</td>
                              <td><strong>{displayValue(reference.referenceName)}</strong></td>
                              <td>{displayValue(reference.relation)}</td>
                              <td>{displayValue(reference.location)}</td>
                              <td>{displayValue(reference.contactNo)}</td>
                              <td>{displayValue(reference.email)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="customer-view-empty">No references provided.</p>
                  )}
                </div>
              )}
            </section>

            <footer className="customer-view-footer">
              <span>This customer profile is read-only.</span>
            </footer>
          </Card>
        )}
      </div>

      <style jsx global>{`
        .customer-view-page {
          min-width: 0;
          color: #243039;
        }

        .customer-view-top-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: -15px;
          margin-bottom: 24px;
        }

        .customer-view-main-title {
          margin: 0;
          color: #23474c;
          font-family: Manrope, sans-serif;
          font-size: 23px;
          font-weight: 700;
        }

        .customer-view-sub-id {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 4px 0 0;
          color: #177e7a;
          font-size: 13px;
          font-weight: 600;
        }

        .customer-view-card {
          padding: 22px;
          border: 1px solid #dfe9eb;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 4px 20px rgba(18, 42, 54, 0.04);
        }

        .customer-view-state {
          min-height: 140px;
          display: grid;
          place-items: center;
          color: #718185;
        }

        /* 6-Tile Summary Header */
        .customer-view-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 2fr)) repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        @media (max-width: 860px) {
          .customer-view-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .customer-view-summary {
            grid-template-columns: 1fr;
          }
        }

        .customer-view-summary-tile {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-height: 68px;
          padding: 12px 14px;
          border: 1px solid #e1ebed;
          border-radius: 9px;
          background: #fbfdfd;
        }

        .customer-view-summary-tile.highlight {
          border-left: 3px solid #177e7a;
          background: #f7fbfb;
        }

        .customer-view-summary-tile span {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #6f858a;
          font-size: 11px;
          font-weight: 600;
          text-transform: none;
          letter-spacing: 0.03em;
        }

        .customer-view-summary-tile strong {
          color: #1d3b48;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.35;
        }

        .kyc-badge {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          width: fit-content;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
        }

        .kyc-badge.verified {
          background: #e7f5ec;
          color: #277a56;
          border: 1px solid #c2e5d0;
        }

        .kyc-badge.pending {
          background: #fef7ed;
          color: #b45309;
          border: 1px solid #fde3be;
        }

        /* Tabs Navigation */
        .customer-view-tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 20px;
          padding: 4px;
          overflow-x: auto;
          border: 1px solid #368262;
          border-radius: 9px;
          background: #fff;
          scrollbar-width: thin;
        }

        .customer-view-tab {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
          min-height: 38px;
          padding: 8px 14px;
          border: 1px solid #c8e5d2;
          border-radius: 6px;
          background: #fff;
          color: #60757b;
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .customer-view-tab:hover {
          background: #edf6f4;
          color: #177e7a;
        }

        .customer-view-tab.active {
          border-color: #c0deda;
          background: #e6f3f0;
          color: #13605d;
          box-shadow: inset 0 -2px 0 #177e7a;
        }

        /* Section Cards & Stacks */
        .customer-view-sections-stack {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .customer-view-section-card {
          padding: 20px 22px;
          border: 1px solid #dfe9eb;
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 2px 8px rgba(23, 63, 73, 0.025);
        }

        .customer-view-section-header {
          margin-bottom: 16px;
          padding-bottom: 11px;
          border-bottom: 1px solid #edf3f4;
        }

        .customer-view-section-header h2 {
          margin: 0;
          color: #1d3b48;
          font-family: Manrope, sans-serif;
          font-size: 15.5px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        /* Responsive Detail Grids */
        .customer-view-grid {
          display: grid;
          gap: 12px;
        }

        .customer-view-grid.three-col {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .customer-view-grid.two-col {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .customer-view-grid.four-col {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        @media (max-width: 920px) {
          .customer-view-grid.three-col,
          .customer-view-grid.four-col {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .customer-view-grid.three-col,
          .customer-view-grid.two-col,
          .customer-view-grid.four-col {
            grid-template-columns: 1fr;
          }
        }

        /* Field Card Tile */
        .view-detail-box {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 12px 14px;
          border: 1px solid #e2ecee;
          border-radius: 8px;
          background: #f8fbfc;
          min-width: 0;
        }

        .view-detail-label {
          color: #6f878d;
          font-size: 11px;
          font-weight: 600;
          text-transform: none;
          letter-spacing: 0.04em;
        }

        .view-detail-value-wrap {
          display: flex;
          align-items: center;
          min-width: 0;
        }

        .view-detail-value {
          color: #1d3b48;
          font-size: 14.5px;
          font-weight: 500;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .view-file-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border: 1px solid #bfe0d8;
          border-radius: 6px;
          background: #edf6f4;
          color: #177e7a;
          font-size: 12px;
          font-weight: 600;
        }

        .view-file-icon {
          color: #177e7a;
          flex-shrink: 0;
        }

        .view-file-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 220px;
        }

        /* Table Styling */
        .customer-view-table-wrap {
          overflow-x: auto;
          border: 1px solid #dfe9eb;
          border-radius: 8px;
          background: #fff;
        }

        .customer-view-table {
          width: 100%;
          min-width: 620px;
          border-collapse: collapse;
          text-align: left;
        }

        .customer-view-table th {
          padding: 12px 14px;
          background: #f8fbfa;
          border-bottom: 1px solid #dfe9eb;
          color: #486369;
          font-family: Manrope, sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: none;
          white-space: nowrap;
        }

        .customer-view-table td {
          padding: 13px 14px;
          border-bottom: 1px solid #edf3f4;
          color: #355358;
          font-size: 12.5px;
          white-space: nowrap;
        }

        .customer-view-table tbody tr:hover {
          background: #f9fcfc;
        }

        .row-sr {
          color: #8c9fa2;
          font-weight: 600;
          text-align: center;
        }

        .view-doc-status-pill {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 10px;
          background: #eaf5f0;
          color: #277955;
          font-size: 11px;
          font-weight: 700;
        }

        .customer-view-empty {
          margin: 0;
          padding: 26px;
          border: 1px dashed #dbe6e4;
          border-radius: 8px;
          color: #7b9195;
          font-size: 13px;
          text-align: center;
        }

        .customer-view-footer {
          margin-top: 22px;
          padding-top: 14px;
          border-top: 1px solid #e8efee;
          color: #8fa0a3;
          font-size: 12px;
          text-align: right;
        }
      `}</style>
    </AppShell>
  );
}
