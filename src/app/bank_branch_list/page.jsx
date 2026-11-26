"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Save,
  Search,
  X,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import {
  getBankBranches,
  updateBankBranch,
} from "../../services/bank_branch";
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

const editableBranchFields = detailSections
  .flatMap((section) => section.fields.map(([, key]) => key))
  .filter((key) => key !== "id");

const branchFieldTypes = {
  incorporationDate: "date",
  workingFrom: "time",
  workingTo: "time",
  primaryContactNumber: "tel",
  secondaryContactNumber: "tel",
  emailId: "email",
};

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
  const [branchForm, setBranchForm] = useState(null);
  const [isEditingBranch, setIsEditingBranch] = useState(false);
  const [isSavingBranch, setIsSavingBranch] = useState(false);
  const [editError, setEditError] = useState("");
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

  function startEditingBranch() {
    setBranchForm(
      Object.fromEntries(
        editableBranchFields.map((key) => [
          key,
          selectedBranch[key] ?? "",
        ]),
      ),
    );
    setEditError("");
    setIsEditingBranch(true);
  }

  async function saveBranchChanges() {
    setIsSavingBranch(true);
    setEditError("");

    const branchPayload = Object.fromEntries(
      editableBranchFields.map((key) => [key, branchForm[key]]),
    );

    try {
      const result = await updateBankBranch(selectedBranch.id, branchPayload);
      const savedBranch =
        result?.data &&
        typeof result.data === "object" &&
        !Array.isArray(result.data)
          ? result.data
          : branchPayload;
      const updatedBranch = { ...selectedBranch, ...savedBranch };

      setSelectedBranch(updatedBranch);
      setBranches((currentBranches) =>
        currentBranches.map((branch) =>
          String(branch.id) === String(selectedBranch.id)
            ? updatedBranch
            : branch,
        ),
      );
      setBranchForm(null);
      setIsEditingBranch(false);
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Unable to update branch.",
      );
    } finally {
      setIsSavingBranch(false);
    }
  }

  return (
    <AppShell>
      <main className="lookup-page branch-list-page">
        <header className="lookup-heading">
          <h1>Branch list</h1>
          <div className="lookup-summary">
            <Building2 size={17} aria-hidden="true" />
            <span>
              <strong>{branches.length}</strong>{" "}
              {branches.length === 1 ? "branch" : "branches"}
            </span>
          </div>
        </header>

        <section className="lookup-list-section">
          <div className="lookup-toolbar">
            <div className="lookup-search">
              <Search size={17} aria-hidden="true" />
              <input
                id="branch-search"
                aria-label="Search branches"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search code, branch, bank, or location"
              />
              {search && (
                <button
                  type="button"
                  className="branch-search-clear"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
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
                            onClick={() => {
                              setSelectedBranch(branch);
                              setBranchForm(null);
                              setIsEditingBranch(false);
                              setEditError("");
                            }}
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
          onMouseDown={() => {
            if (!isSavingBranch) setSelectedBranch(null);
          }}
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
                disabled={isSavingBranch}
                aria-label="Close branch details"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className="branch-detail-content">
              {editError && (
                <p className="branch-edit-error" role="alert">
                  {editError}
                </p>
              )}
              {detailSections.map((section) => (
                <section className="branch-detail-section" key={section.title}>
                  <h3>{section.title}</h3>
                  <dl>
                    {section.fields.map(([label, key]) => (
                      <div className="branch-detail-field" key={key}>
                        <dt>{label}</dt>
                        <dd>
                          {isEditingBranch && key !== "id" ? (
                            <input
                              className="branch-detail-input"
                              type={branchFieldTypes[key] || "text"}
                              aria-label={label}
                              value={branchForm?.[key] ?? ""}
                              onChange={(event) =>
                                setBranchForm((currentForm) => ({
                                  ...currentForm,
                                  [key]: event.target.value,
                                }))
                              }
                            />
                          ) : (
                            displayValue(selectedBranch[key])
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
            <footer className="branch-detail-footer">
              {isEditingBranch ? (
                <>
                  <button
                    type="button"
                    className="lookup-button secondary"
                    onClick={() => {
                      setBranchForm(null);
                      setIsEditingBranch(false);
                      setEditError("");
                    }}
                    disabled={isSavingBranch}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="lookup-button primary"
                    onClick={saveBranchChanges}
                    disabled={isSavingBranch}
                  >
                    <Save size={14} aria-hidden="true" />
                    {isSavingBranch ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="lookup-button primary branch-edit-button"
                    onClick={startEditingBranch}
                  >
                    <Pencil size={14} aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="lookup-button secondary"
                    onClick={() => setSelectedBranch(null)}
                  >
                    Close
                  </button>
                </>
              )}
            </footer>
          </section>
        </div>
      )}
    </AppShell>
  );
}
