'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Eye,
  FilePlus2,
  Pencil,
  Search,
} from 'lucide-react';
import AppShell from './AppShell';
import Card from './Card';
import PageHeader from './PageHeader';
import LoanDashboardStyles from './LoanDashboardStyles';
import { api } from '../services/api';
import {
  formatAmount,
  formatApplicationDate,
  getApplicationId,
  getCustomerName,
  getStatusClass,
  getStatusLabel,
  isGoldLoanApplication,
  persistGoldLoanApplication,
  readSavedGoldLoanApplications,
} from './GoldLoanApplication';

const PAGE_SIZE = 10;

const formatApplicationIdDisplay = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Not available';

  if (/^GL-/i.test(raw)) {
    const parts = raw.split('-').filter(Boolean);
    if (parts.length >= 3) {
      const [prefix, maybeTs, ...rest] = parts;
      if (/^\d{10,}$/.test(maybeTs)) {
        return `${prefix}-${rest.join('-') || maybeTs}`;
      }
    }
  }

  return raw;
};

function getApplicationRecords() {
  const savedApplications = readSavedGoldLoanApplications();
  const savedById = new Map(
    savedApplications.map((application) => [getApplicationId(application), application]),
  );
  const baseApplications = (Array.isArray(api.applications) ? api.applications : [])
    .map((application) => ({
      ...application,
      ...(savedById.get(getApplicationId(application)) || {}),
    }));
  const baseIds = new Set(baseApplications.map(getApplicationId));
  const newApplications = savedApplications.filter(
    (application) => !baseIds.has(getApplicationId(application)),
  );

  return [...baseApplications, ...newApplications].filter(isGoldLoanApplication);
}

export default function GoldLoanDashboard() {
  const router = useRouter();
  const [applications, setApplications] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [persistenceError, setPersistenceError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const applicationsAvailable = Array.isArray(api.applications);

  useEffect(() => {
    try {
      setApplications(getApplicationRecords());
    } catch (error) {
      setPersistenceError(
        error instanceof Error
          ? `Saved Gold Loan applications could not be loaded: ${error.message}`
          : 'Saved Gold Loan applications could not be loaded from this browser.',
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  const counts = useMemo(() => ({
    total: applications.length,
    approved: applications.filter(
      (application) => String(application.status || '').trim().toLowerCase() === 'approved',
    ).length,
    disbursed: applications.filter(
      (application) => String(application.status || '').trim().toLowerCase() === 'disbursed',
    ).length,
  }), [applications]);

  const filteredApplications = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return applications;

    return applications.filter((application) => {
      const form = application.goldLoanForm || {};
      return [
        getApplicationId(application),
        getCustomerName(application),
        application.customerId,
        form.loanAccountNumber,
        application.branch || form.branch,
        getStatusLabel(application.status),
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    });
  }, [applications, searchTerm]);
  const pageCount = Math.max(1, Math.ceil(filteredApplications.length / PAGE_SIZE));
  const pageApplications = filteredApplications.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const persistApplication = (application) => {
    persistGoldLoanApplication(application);
    setApplications((currentApplications) => {
      const existingIndex = currentApplications.findIndex(
        (saved) => getApplicationId(saved) === getApplicationId(application),
      );
      if (existingIndex < 0) return [application, ...currentApplications];

      return currentApplications.map((saved, index) => (
        index === existingIndex ? { ...saved, ...application } : saved
      ));
    });
    setPersistenceError('');
    setSaveNotice(`${getApplicationId(application)} was saved in this browser.`);
  };

  const createApplication = (form) => {
    const now = new Date();
    const identifier = window.crypto?.randomUUID?.().slice(0, 8)
      || Math.random().toString(36).slice(2, 10).toUpperCase();
    const customerName = [form.firstName, form.middleName, form.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const application = {
      id: `GL-${now.getTime()}-${identifier}`,
      customer: customerName,
      customerName,
      customerId: form.customerId,
      product: 'Gold Loan',
      amount: form.sanctionLimit,
      applicationDate: now.toISOString().slice(0, 10),
      branch: form.branch,
      status: 'Pending',
      goldLoanForm: form,
    };

    persistApplication(application);
  };

  const metrics = [
    { label: 'Total No. of Applications', value: counts.total, icon: FilePlus2, tone: 'teal' },
    { label: 'Approved Applications', value: counts.approved, icon: CheckCircle2, tone: 'green' },
    { label: 'Disbursed Applications', value: counts.disbursed, icon: Banknote, tone: 'blue' },
  ];

  return (
    <AppShell title="Gold Loan Dashboard">
      <div className="loan-dashboard">
        {persistenceError && (
          <div className="bank-master-alert" role="alert">{persistenceError}</div>
        )}
        {saveNotice && <div className="bank-master-alert" role="status">{saveNotice}</div>}
        <PageHeader
          title="Gold Loan Dashboard"
          action={(
            <button
              className="primary-button apply-button"
              type="button"
              onClick={() => router.push('/gold_loan_application/apply')}
            >
              <Coins size={16} aria-hidden="true" />
              Apply for Gold Loan
            </button>
          )}
        />

        <section className="loan-metrics" aria-label="Gold Loan application summary">
          {metrics.map(({ label, value, icon: Icon, tone }) => (
            <Card className="loan-metric-card" key={label}>
              <div className={`loan-metric-icon ${tone}`}>
                <Icon size={19} aria-hidden="true" />
              </div>
              <div>
                <p>{label}</p>
                <strong>{value}</strong>
              </div>
            </Card>
          ))}
        </section>

        <Card className="loan-table-card">
          <div className="loan-table-heading">
            <div><h2>Gold Loan Applications</h2></div>
            <span className="sample-data-label">Development sample data</span>
          </div>

          <form
            className="loan-search-row"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchTerm(searchInput);
              setCurrentPage(1);
            }}
          >
            <label className="loan-search">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by application ID, customer, customer ID, or account number"
                aria-label="Search Gold Loan applications"
              />
            </label>
            <button className="secondary-button loan-search-button" type="submit">
              <Search size={15} aria-hidden="true" />
              Search
            </button>
          </form>

          {!applicationsAvailable ? (
            <div className="loan-table-message error-message" role="alert">
              Application records are unavailable. Please try again later.
            </div>
          ) : !loaded ? (
            <div className="loan-table-message" role="status">Loading Gold Loan applications...</div>
          ) : filteredApplications.length === 0 ? (
            <div className="loan-table-message">
              <FilePlus2 size={22} aria-hidden="true" />
              <strong>
                {applications.length === 0
                  ? 'No Gold Loan applications yet'
                  : 'No applications match your search'}
              </strong>
              <span>
                {applications.length === 0
                  ? 'Applications will appear here when they are available.'
                  : 'Try another application ID, customer name, customer ID, or account number.'}
              </span>
            </div>
          ) : (
            <>
              <div className="loan-table-scroll">
                <table className="loan-applications-table">
                  <thead>
                    <tr>
                      <th scope="col">Sr. No.</th>
                      <th scope="col">Application ID</th>
                      <th scope="col">Customer Name</th>
                      <th scope="col">Customer ID</th>
                      <th scope="col">Loan Account Number</th>
                      <th scope="col">Loan Amount</th>
                      <th scope="col">Application Date</th>
                      <th scope="col">Branch</th>
                      <th scope="col">Status</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageApplications.map((application, index) => {
                      const id = getApplicationId(application);
                      return (
                        <tr key={id}>
                          <td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                          <td><strong className="application-id">{formatApplicationIdDisplay(id)}</strong></td>
                          <td>{getCustomerName(application)}</td>
                          <td>{application.customerId || application.goldLoanForm?.customerId || 'Not available'}</td>
                          <td>{application.goldLoanForm?.loanAccountNumber || 'Not available'}</td>
                          <td className="loan-amount">{formatAmount(application.amount)}</td>
                          <td>{formatApplicationDate(application.applicationDate || application.createdAt || application.date)}</td>
                          <td>{application.branch || application.goldLoanForm?.branch || 'Not available'}</td>
                          <td>
                            <span className={`loan-status ${getStatusClass(application.status)}`}>
                              {getStatusLabel(application.status)}
                            </span>
                          </td>
                          <td>
                            <div className="application-actions">
                              <button
                                className="application-action-button"
                                type="button"
                                onClick={() => router.push(`/gold_loan_application/view/${encodeURIComponent(id)}`)}
                                aria-label={`View Gold Loan application ${formatApplicationIdDisplay(id)}`}
                                title="View application"
                              >
                                <Eye size={16} aria-hidden="true" />
                              </button>
                              <button
                                className="application-action-button"
                                type="button"
                                onClick={() => router.push(`/gold_loan_application/edit/${encodeURIComponent(id)}`)}
                                aria-label={`Edit Gold Loan application ${formatApplicationIdDisplay(id)}`}
                                title="Edit application"
                              >
                                <Pencil size={15} aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="loan-pagination" aria-label="Gold Loan application pagination">
                <div className="loan-pagination-controls">
                  <span className="loan-page-indicator" aria-live="polite">Page {currentPage} of {pageCount}</span>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={15} aria-hidden="true" />
                    Previous
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                    disabled={currentPage === pageCount}
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}

          {loaded && applications.length > 0 && (
            <p className="data-note">
              These records come from the existing in-project application data and saved browser changes.
            </p>
          )}
        </Card>
      </div>
      <LoanDashboardStyles />
      <style jsx>{`
        .loan-dashboard {
          min-width: 0;
          font-size: 12px;
        }

        .loan-dashboard :global(.page-header) {
          margin-top: 0;
          margin-bottom: 12px;
          padding-top: 0;
        }

        .loan-dashboard :global(.page-header h1) {
          margin: 0;
          font-size: 24px;
          line-height: 1.2;
        }

        .loan-dashboard :global(.loan-metrics) {
          gap: 12px;
          margin-bottom: 14px;
        }

        .loan-dashboard :global(.loan-metric-card.card) {
          display: grid;
          grid-template-columns: 36px minmax(0, 1fr);
          align-items: center;
          gap: 10px;
          min-height: 72px;
          padding: 12px 14px;
          border-radius: 10px;
        }

        .loan-dashboard :global(.loan-metric-icon) {
          width: 36px;
          height: 36px;
          border-radius: 9px;
        }

        .loan-dashboard :global(.loan-metric-card p) {
          margin: 0 0 2px;
          font-size: 11px;
          line-height: 1.25;
        }

        .loan-dashboard :global(.loan-metric-card strong) {
          font-size: 20px;
          line-height: 1.1;
        }

        .loan-dashboard :global(.loan-table-card.card) {
          padding: 14px;
          border-radius: 10px;
        }

        .loan-dashboard :global(.loan-table-heading) {
          margin-bottom: 10px;
          gap: 10px;
        }

        .loan-dashboard :global(.loan-table-heading h2) {
          margin: 0;
          font-size: 15px;
        }

        .loan-dashboard :global(.sample-data-label),
        .loan-dashboard :global(.data-note),
        .loan-dashboard :global(.loan-table-message) {
          font-size: 11px;
        }

        .loan-dashboard :global(.loan-search-row) {
          gap: 8px;
          margin-bottom: 10px;
        }

        .loan-dashboard :global(.loan-search) {
          min-height: 36px;
          padding: 0 10px;
          gap: 8px;
        }

        .loan-dashboard :global(.loan-search input) {
          height: 34px;
          font-size: 12px;
        }

        .loan-dashboard :global(.loan-search-button) {
          min-height: 36px;
          padding: 0 12px;
          font-size: 12px;
        }

        .loan-dashboard :global(.loan-table-scroll) {
          overflow-x: auto;
        }

        .loan-dashboard :global(.loan-applications-table) {
          width: 100%;
          min-width: 980px;
          border-collapse: separate;
          border-spacing: 0;
        }

        .loan-dashboard :global(.loan-applications-table th) {
          padding: 9px 8px;
          font-size: 11px;
          font-weight: 700;
          text-align: center;
          vertical-align: middle;
          line-height: 1.3;
          white-space: nowrap;
        }

        .loan-dashboard :global(.loan-applications-table td) {
          padding: 9px 8px;
          font-size: 11.5px;
          text-align: center;
          vertical-align: middle;
          line-height: 1.35;
        }

        .loan-dashboard :global(.loan-applications-table .loan-amount) {
          text-align: center;
        }

        .loan-dashboard :global(.application-actions) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .loan-dashboard :global(.application-action-button) {
          width: 28px;
          height: 28px;
        }

        .loan-pagination {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          padding: 12px 0 0;
          color: #718185;
          font-size: 11px;
        }

        .loan-pagination-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: auto;
        }

        .loan-page-indicator {
          font-weight: 600;
          color: #5f7075;
          white-space: nowrap;
        }

        .loan-pagination button {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 32px;
          padding: 0 10px;
          font-size: 11px;
        }

        .loan-pagination button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        @media (max-width: 640px) {
          .loan-pagination {
            justify-content: flex-start;
          }

          .loan-pagination-controls {
            width: 100%;
            justify-content: space-between;
            margin-left: 0;
            flex-wrap: wrap;
          }
        }
      `}</style>
    </AppShell>
  );
}
