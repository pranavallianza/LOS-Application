"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  X,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import { getBankBranches } from "../../services/bank_branch";
import "../lookup_management/lookup-management.css";
import "./branch-list.css";

const PAGE_SIZE = 10;
const SAMPLE_BRANCHES = [
  {
    id: 99001,
    bankName: "Sample National Bank",
    branchCode: "DEMO-001",
    branchName: "Demo Mumbai Branch",
    rbiLicenseNo: "DEMO-LIC-001",
    registrationNo: "DEMO-REG-001",
    incorporationDate: "2001-04-12",
    workingFrom: "09:30",
    workingTo: "17:30",
    address: "100 Example Road",
    address1: "Business District",
    address2: "Demo Building",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    pinCode: "400001",
    primaryContactNumber: "9000000001",
    secondaryContactNumber: "9000000002",
    emailId: "mumbai.branch@example.com",
  },
  {
    id: 99002,
    bankName: "Sample National Bank",
    branchCode: "DEMO-002",
    branchName: "Demo Pune Branch",
    rbiLicenseNo: "DEMO-LIC-002",
    registrationNo: "DEMO-REG-002",
    incorporationDate: "2004-08-20",
    workingFrom: "10:00",
    workingTo: "18:00",
    address: "200 Example Street",
    address1: "Central Area",
    address2: "Demo Plaza",
    city: "Pune",
    state: "Maharashtra",
    country: "India",
    pinCode: "411001",
    primaryContactNumber: "9000000003",
    secondaryContactNumber: "9000000004",
    emailId: "pune.branch@example.com",
  },
];

const detailSections = [
  {
    title: "Branch Information",
    fields: [
      ["Branch ID", "id"],
      ["Bank Name", "bankName"],
      ["Branch Code", "branchCode"],
      ["Branch Name", "branchName"],
      ["RBI License Number", "rbiLicenseNo"],
      ["Registration Number", "registrationNo"],
      ["Incorporation Date", "incorporationDate"],
      ["Working From", "workingFrom"],
      ["Working To", "workingTo"],
    ],
  },
  {
    title: "Address",
    fields: [
      ["Address", "address"],
      ["Address Line 1", "address1"],
      ["Address Line 2", "address2"],
      ["City", "city"],
      ["State", "state"],
      ["Country", "country"],
      ["PIN Code", "pinCode"],
    ],
  },
  {
    title: "Contact Information",
    fields: [
      ["Primary Contact Number", "primaryContactNumber"],
      ["Secondary Contact Number", "secondaryContactNumber"],
      ["Email Address", "emailId"],
    ],
  },
];

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "—"
    : String(value);
}

export default function BankBranchListPage() {
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setFallbackMessage("");

    getBankBranches(controller.signal)
      .then((data) => {
        if (data.length === 0) {
          setBranches(SAMPLE_BRANCHES);
          setFallbackMessage(
            "The API returned no branches. Showing two sample records.",
          );
          return;
        }
        setBranches(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setBranches(SAMPLE_BRANCHES);
          setFallbackMessage(``);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  const filteredBranches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return branches;
    return branches.filter((branch) =>
      [
        branch.id,
        branch.bankName,
        branch.branchCode,
        branch.branchName,
        branch.city,
        branch.state,
        branch.country,
        branch.pinCode,
      ]
        .map((value) => String(value ?? ""))
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [branches, search]);

  const pageCount = Math.max(1, Math.ceil(filteredBranches.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleBranches = filteredBranches.slice(
    startIndex,
    startIndex + PAGE_SIZE,
  );

  return (
    <AppShell>
      <main className="lookup-page branch-list-page">
        <header className="lookup-heading">
          <div>
            <p className="lookup-eyebrow">BANK PROFILE</p>
            <h1>Bank Branches</h1>
            <p className="lookup-subtitle">
              Browse registered bank branches and their details.
            </p>
          </div>
          <div className="lookup-summary">
            <Building2 size={17} aria-hidden="true" />
            <span>
              <strong>{branches.length}</strong> branches
            </span>
          </div>
        </header>

        <section className="lookup-list-section">
          <div className="lookup-list-heading">
            <div>
              <h2>Branch list</h2>
              <p>View branch registration, address, and contact information.</p>
            </div>
            <span className="lookup-count">
              {isLoading
                ? "Loading"
                : `${filteredBranches.length} ${filteredBranches.length === 1 ? "record" : "records"}`}
            </span>
          </div>

          <div className="lookup-toolbar">
            <label className="lookup-search" htmlFor="branch-search">
              <Search size={17} aria-hidden="true" />
              <input
                id="branch-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search code, branch, bank, or location"
              />
            </label>
          </div>

          {fallbackMessage && (
            <div className="branch-fallback-notice" role="status">
              <span>{fallbackMessage}</span>
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Retry
              </button>
            </div>
          )}

          <div className="lookup-table-wrap">
            <table className="lookup-table branch-table">
              <thead>
                <tr>
                  <th>Branch Code</th>
                  <th>Branch Name</th>
                  <th>Bank Name</th>
                  <th>City</th>
                  <th>State</th>
                  <th className="actions-column">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="lookup-empty" colSpan="6">
                      <strong>Loading branches...</strong>
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  visibleBranches.map((branch, index) => (
                    <tr
                      key={
                        branch.id ??
                        `${branch.branchCode}-${startIndex + index}`
                      }
                    >
                      <td>
                        <span className="lookup-code">
                          {displayValue(branch.branchCode)}
                        </span>
                      </td>
                      <td>
                        <span className="lookup-name">
                          {displayValue(branch.branchName)}
                        </span>
                      </td>
                      <td>{displayValue(branch.bankName)}</td>
                      <td>{displayValue(branch.city)}</td>
                      <td>{displayValue(branch.state)}</td>
                      <td>
                        <div className="lookup-row-actions">
                          <button
                            className="lookup-icon-action with-label"
                            type="button"
                            onClick={() => setSelectedBranch(branch)}
                            aria-label={`View ${branch.branchName || `branch ${branch.id}`}`}
                            title="View branch details"
                          >
                            <Eye size={14} aria-hidden="true" />
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {!isLoading && visibleBranches.length === 0 && (
                  <tr>
                    <td className="lookup-empty" colSpan="6">
                      <div className="lookup-empty-icon">
                        <Search size={20} aria-hidden="true" />
                      </div>
                      <strong>
                        {branches.length
                          ? "No matching branches"
                          : "No branches yet"}
                      </strong>
                      <span>
                        {branches.length
                          ? "Try a different search term."
                          : "No bank branches were returned."}
                      </span>
                      {branches.length > 0 && search && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setPage(1);
                          }}
                        >
                          Clear search
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="lookup-pagination">
            <span>
              Showing {filteredBranches.length ? startIndex + 1 : 0}–
              {Math.min(startIndex + PAGE_SIZE, filteredBranches.length)} of{" "}
              {filteredBranches.length}
            </span>
            <div>
              <button
                type="button"
                aria-label="Previous page"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="current"
                aria-current="page"
                aria-label={`Page ${currentPage} of ${pageCount}`}
              >
                {currentPage} / {pageCount}
              </button>
              <button
                type="button"
                aria-label="Next page"
                onClick={() =>
                  setPage((value) => Math.min(pageCount, value + 1))
                }
                disabled={currentPage === pageCount}
              >
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
          </footer>
        </section>
      </main>

      {selectedBranch && (
        <div
          className="branch-detail-backdrop"
          onMouseDown={() => setSelectedBranch(null)}
        >
          <section
            className="branch-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="branch-detail-header">
              <div>
                <p className="lookup-eyebrow">BRANCH RECORD</p>
                <h2 id="branch-detail-title">
                  {displayValue(selectedBranch.branchName)}
                </h2>
                <span className="branch-detail-code">
                  Branch code: {displayValue(selectedBranch.branchCode)}
                </span>
              </div>
              <button
                type="button"
                className="branch-detail-close"
                onClick={() => setSelectedBranch(null)}
                aria-label="Close branch details"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className="branch-detail-content">
              {detailSections.map((section) => (
                <section className="branch-detail-section" key={section.title}>
                  <h3>{section.title}</h3>
                  <dl>
                    {section.fields.map(([label, key]) => (
                      <div className="branch-detail-field" key={key}>
                        <dt>{label}</dt>
                        <dd>{displayValue(selectedBranch[key])}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
            <footer className="branch-detail-footer">
              <button
                type="button"
                className="lookup-button secondary"
                onClick={() => setSelectedBranch(null)}
              >
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
    </AppShell>
  );
}
