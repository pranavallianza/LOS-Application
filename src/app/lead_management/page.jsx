'use client';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, FileSpreadsheet, Pencil, Plus, Search, Upload, X } from 'lucide-react';
import Calendar from 'react-calendar';
import AppShell from '../../components/AppShell';
import LeadDatePicker from '../../components/LeadDatePicker';
import PageHeader from '../../components/PageHeader';
import NewLead from '../../components/NewLead';
import CorporateLeadWizard from '../../components/CorporateLeadWizard';
import LeadDetails from '../../components/LeadDetails';
import { getLeads, saveLeads } from '../../services/localLeads';
import {
  assignRetailLead,
  createRetailLead,
  getAllRetailLeads,
  getRetailLead,
  getRetailLeads,
  getRetailLookups,
  updateRetailLead,
} from '../../services/retail_lead_management';

const leadTableColumns = [
    ['srNo', 'Sr. No.'],
  ['id', 'Lead ID'],
  ['customerName', 'Customer Name'],
  ['mobileNumber', 'Mobile Number'],
  ['assignedToName', 'Assigned To'],
  ['status', 'Status'],
  ['date', 'Lead Date'],
];

const normalizeLeadTitle = (title) => {
  const value = String(title || '').trim();
  const normalizedTitle = value.toLowerCase().replace(/\.$/, '');
  return { mr: 'Mr.', ms: 'Ms.', mrs: 'Mrs.' }[normalizedTitle] || value;
};

const leadFieldValue = (lead, field) => {
  const aliases = {
    customerName: [
      normalizeLeadTitle(lead.namePrefix || lead.title),
      lead.firstName,
      lead.middleName,
      lead.lastName,
    ].filter(Boolean).join(' ') || lead.customerName || lead.name,
    mobileNumber: lead.mobileNumber || lead.mobile,
    assignedBy: lead.assignedBy || lead.createdBy,
    assignedToName: lead.assignedToName || lead.assignedCheckerName || lead.assignedViewerName,
    date: lead.date || lead.leadDate,
  };
  return Object.prototype.hasOwnProperty.call(aliases, field) ? aliases[field] : lead[field];
};

const statusKeys = {
  Pending: 'new',
  New: 'new',
  'In Progress': 'progress',
  Contacted: 'contacted',
  Qualified: 'qualified',
  'On Hold': 'progress',
  Rejected: 'progress',
  Converted: 'qualified',
  NEW: 'new',
  PENDING: 'new',
  IN_PROGRESS: 'progress',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  REJECTED: 'progress',
  CONVERTED: 'qualified',
};

const LEADS_PER_PAGE = 10;

const toIsoDate = (date) => {
  const value = String(date || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const [day, month, year] = value.split('-');
  return year && month && day ? `${year}-${month}-${day}` : '';
};

const dateFromIso = (value) => value ? new Date(`${value}T00:00:00`) : null;
const dateToIso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const formatFilterDate = (value) => dateFromIso(value)?.toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
}) || 'Select date';

const csvCell = (value) => {
  const text = value === null || value === undefined
    ? ''
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
};

const leadsToCsv = (records) => {
  const columns = [...new Set(records.flatMap((lead) => Object.keys(lead)))];
  return [
    columns.map(csvCell).join(','),
    ...records.map((lead) => columns.map((column) => csvCell(lead[column])).join(',')),
  ].join('\r\n');
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  const input = text.replace(/^\uFEFF/, '');

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('The CSV must include a header row and at least one lead.');

  const headers = rows[0].map((header) => header.trim());
  if (headers.some((header) => !header)) throw new Error('Every CSV column must have a header.');
  return rows.slice(1).map((cells) => Object.fromEntries(
    headers.map((header, index) => [header, cells[index] ?? '']),
  ));
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const normalizeLeadRecord = (lead) => {
  const rawCustomerNameParts = String(lead.customerName || lead.name || '').trim().split(/\s+/).filter(Boolean);
  const inferredTitle = /^(mr\.?|mrs\.?|ms\.?|miss|dr\.?)$/i.test(rawCustomerNameParts[0] || '') ? rawCustomerNameParts[0] : '';
  const nameParts = inferredTitle ? rawCustomerNameParts.slice(1) : rawCustomerNameParts;
  const apiDate = lead.date || lead.leadDate || lead.createdAt || '';
  const dateMatch = String(apiDate).match(/^(\d{4})-(\d{2})-(\d{2})/);

  return {
    ...lead,
    id: lead.leadId || lead.id || lead._id || '',
    entityName: lead.entityName || lead.organizationName || lead.legalName
      || (String(lead.leadType || lead.customerType || '').toLowerCase().includes('corporate')
        ? lead.customerName || lead.name || ''
        : ''),
    registrationNo: lead.registrationNo || lead.registrationNumber || lead.cin || lead.llpin || '',
    namePrefix: normalizeLeadTitle(lead.namePrefix || lead.title || inferredTitle),
    firstName: lead.firstName || nameParts[0] || '',
    middleName: lead.middleName || (nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : ''),
    lastName: lead.lastName || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''),
    mobileNumber: lead.mobileNumber || lead.mobile || lead.phoneNumber || '',
    email: lead.email || lead.emailAddress || '',
    panCard: lead.panCard || lead.panNumber || '',
    aadhaarCard: lead.aadhaarCard || lead.aadhaarNumber || '',
    passportNo: lead.passportNo || lead.passportNumber || '',
    dependents: lead.dependents ?? lead.numberOfDependents ?? '',
    loanPurpose: lead.loanPurpose || lead.purposeOfLoan || '',
    instalments: lead.instalments ?? lead.numberOfInstalments ?? '',
    monthlyEmi: lead.monthlyEmi ?? lead.emi ?? '',
    collateral: lead.collateral ?? lead.downPaymentCollateral ?? '',
    deductions: lead.deductions ?? lead.deductionsOrEmisPayable ?? '',
    primaryBankAccount: lead.primaryBankAccount || lead.accountNumber || '',
    acquisitionChannel: lead.acquisitionChannel || lead.leadAcquisitionChannel || lead.source || '',
    referralDate: lead.referralDate || lead.date || '',
    partnerId: lead.partnerId || lead.sourcingAgentPartnerId || '',
    partnerName: lead.partnerName || lead.agentPartnerName || '',
    assignedBy: lead.assignedBy || lead.createdBy || '',
    assignedToName: lead.assignedToName || lead.assignedCheckerName || lead.assignedViewerName || '',
    date: dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : apiDate,
    name: lead.entityName || lead.organizationName || lead.legalName || lead.customerName || lead.name || nameParts.join(' '),
    status: lead.leadStatus || lead.status || 'New',
    statusKey: statusKeys[lead.leadStatus || lead.status] || 'new',
    product: lead.loanProductType || lead.product || '',
    amount: lead.loanAmount ?? lead.amount ?? '',
    source: lead.leadAcquisitionChannel || lead.acquisitionChannel || lead.source || '',
  };
};

const leadManagementStyles = `
.los-page-wrap{width:100%;max-width:none;padding-right:24px;padding-left:24px;box-sizing:border-box}
.lm-page{display:block;width:100%;max-width:none;margin:0;padding:4px 0 28px;box-sizing:border-box;color:#20383a;font-family:var(--font-sans,inherit)}
.lm-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:19px}
.lm-page-header.page-header{margin-bottom:19px}
.lm-heading-copy span{color:#748789;font-size:10px;font-weight:800;letter-spacing:.1em}
.lm-heading-copy h1{margin:5px 0 4px;color:#193f42;font-size:24px;font-weight:750}
.lm-heading-copy p{margin:0;color:#748587;font-size:12px;line-height:1.5}
.lm-add-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 15px;border:1px solid #177e7a;border-radius:5px;background:#177e7a;color:#fff;font-size:12px;font-weight:700;white-space:nowrap;cursor:pointer}
.lm-add-button:hover{border-color:#0c6662;background:#0c6662}
.lm-toolbar{display:grid;grid-template-columns:minmax(125px,.75fr) repeat(3,minmax(145px,1fr)) auto;align-items:end;gap:12px;margin-bottom:14px;padding:14px;border:1px solid #dfe8e6;border-radius:6px;background:#f8faf9}
.lm-filter{display:grid;gap:6px;min-width:0;color:#52696b;font-size:10px;font-weight:700}
.lm-search-box{display:flex;align-items:center;gap:8px;min-width:0;height:39px;padding:0 10px;border:1px solid #cbd9d7;border-radius:5px;background:#fff;color:#78898a}
.lm-search-box:focus-within{border-color:#568e88;box-shadow:0 0 0 3px rgba(23,126,122,.1)}
.lm-search-box input{width:100%;min-width:0;height:100%;border:0;outline:0;background:transparent;color:#203c42;font:inherit;font-size:12px}
.lm-filter select,.lm-filter>input{width:100%;min-width:0;height:39px;padding:0 10px;border:1px solid #cbd9d7;border-radius:5px;background:#fff;color:#30494b;font:inherit;font-size:12px;outline:none}
.lm-filter select:focus,.lm-filter>input:focus{border-color:#568e88;box-shadow:0 0 0 3px rgba(23,126,122,.1)}
.lm-date-picker .dob-picker-trigger{width:100%;height:39px;padding:0 10px;border:1px solid #cbd9d7;border-radius:5px;background:#fff;color:#30494b;font:inherit;font-size:12px;font-weight:400;outline:none}
.lm-date-picker .dob-picker-trigger:focus{border-color:#568e88;box-shadow:0 0 0 3px rgba(23,126,122,.1)}
.lm-filter-date-to .dob-calendar-popover{left:auto;right:8px}
.lm-reset{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:39px;padding:0 11px;border:1px solid #cfddda;border-radius:5px;background:#fff;color:#536a6c;font-size:11px;font-weight:700;white-space:nowrap;cursor:pointer}
.lm-reset:hover{background:#eff6f4}
.lm-results{overflow:hidden;border:1px solid #dfe8e6;border-radius:6px;background:#fff}
.lm-results-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid #e8eeec;color:#738486;font-size:10px}
.lm-results-meta strong{color:#355356;font-size:11px}
.lm-table-wrap{overflow:auto;max-width:100%}
.lm-table{width:100%;min-width:890px;border-collapse:collapse;table-layout:auto}
.lm-table th,.lm-table td{height:48px;padding:9px 12px;border-bottom:1px solid #edf1f0;text-align:left;white-space:nowrap;font-size:11px}
.lm-table th{height:40px;background:#f5f8f7;color:#5a7072;font-size:9px;font-weight:800;letter-spacing:.035em;text-transform:uppercase}
.lm-table tbody tr:hover{background:#fafcfb}
.lm-table tbody tr:last-child td{border-bottom:0}
.lm-table td{color:#354d4f}
.lm-table .lm-id{color:#176e67;font-weight:750}
.lm-status{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid #e1e9e7;border-radius:4px;background:#f6f8f7;color:#536a6c;font-size:10px;font-weight:700}
.lm-status:before{width:6px;height:6px;border-radius:50%;background:#9bacaa;content:''}
.lm-status.status-new{border-color:#d5e5e3;background:#f0f7f5;color:#256c67}.lm-status.status-new:before{background:#49978a}
.lm-status.status-progress{border-color:#efe4c8;background:#fffaf0;color:#846b31}.lm-status.status-progress:before{background:#c59a40}
.lm-status.status-contacted{border-color:#d7e6f0;background:#f2f8fb;color:#3e6f8c}.lm-status.status-contacted:before{background:#5b9aba}
.lm-status.status-qualified{border-color:#cfe5d9;background:#f1faf4;color:#32744d}.lm-status.status-qualified:before{background:#4e9a67}
.lm-actions{display:flex;align-items:center;gap:5px}
.lm-action{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:30px;padding:0 8px;border:1px solid #d8e3e1;border-radius:4px;background:#fff;color:#315d5b;font-size:10px;font-weight:700;cursor:pointer}
.lm-action:hover{border-color:#a9cbc3;background:#f1f8f5}
.lm-dialog-backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:18px;background:rgba(18,38,39,.48)}
.lm-assignment-dialog{width:min(100%,420px);padding:22px;border:1px solid #dfe8e6;border-radius:8px;background:#fff;box-shadow:0 18px 60px rgba(19,44,43,.24)}
.lm-assignment-dialog h2{margin:0 0 6px;color:#193f42;font-size:18px}
.lm-assignment-dialog p{margin:0 0 18px;color:#748587;font-size:12px}
.lm-assignment-dialog label{display:grid;gap:7px;color:#52696b;font-size:11px;font-weight:700}
.lm-assignment-dialog select{width:100%;height:40px;padding:0 10px;border:1px solid #cbd9d7;border-radius:5px;background:#fff;color:#30494b;font:inherit;font-size:12px}
.lm-assignment-error{margin:12px 0 0!important;color:#9d3030!important}
.lm-assignment-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}
.lm-assignment-actions button{min-height:36px;padding:0 12px;border:1px solid #d2dfdc;border-radius:5px;background:#fff;color:#52696b;font-size:11px;font-weight:700;cursor:pointer}
.lm-assignment-actions button[type=submit]{border-color:#177e7a;background:#177e7a;color:#fff}
.lm-assignment-actions button:disabled{cursor:not-allowed;opacity:.6}
.lm-heading-actions{display:flex;align-items:center;gap:9px}
.lm-export-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 15px;border:1px solid #cbd9d7;border-radius:5px;background:#fff;color:#315d5b;font-size:12px;font-weight:700;white-space:nowrap;cursor:pointer}
.lm-export-button:hover{border-color:#a9cbc3;background:#f1f8f5}
.lm-export-dialog{width:min(100%,440px);padding:22px;border:1px solid #dfe8e6;border-radius:8px;background:#fff;box-shadow:0 18px 60px rgba(19,44,43,.24)}
.lm-export-dialog h2{margin:0 0 6px;color:#193f42;font-size:18px}
.lm-export-dialog>p{margin:0 0 18px;color:#748587;font-size:12px}
.lm-export-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.lm-export-option{display:grid;justify-items:start;gap:9px;min-height:105px;padding:14px;border:1px solid #d8e3e1;border-radius:6px;background:#fff;color:#315d5b;text-align:left;font:inherit;cursor:pointer}
.lm-export-option:hover:not(:disabled),.lm-export-option.selected{border-color:#70aaa0;background:#f1f8f5}
.lm-export-option:disabled{cursor:wait;opacity:.7}
.lm-export-option strong{color:#315356;font-size:12px}
.lm-export-option span{color:#748587;font-size:10px;line-height:1.4}
.lm-export-dates{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}
.lm-export-dates label{display:grid;gap:6px;color:#52696b;font-size:10px;font-weight:700}
.lm-export-dates input{height:39px;padding:0 9px;border:1px solid #cbd9d7;border-radius:5px;background:#fff;color:#30494b;font:inherit;font-size:12px}
.lm-export-error{margin:12px 0 0!important;color:#9d3030!important}
.lm-export-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}
.lm-export-actions button{min-height:36px;padding:0 12px;border:1px solid #d2dfdc;border-radius:5px;background:#fff;color:#52696b;font-size:11px;font-weight:700;cursor:pointer}
.lm-export-actions button[type=submit]{border-color:#177e7a;background:#177e7a;color:#fff}
.lm-export-actions button:disabled{cursor:not-allowed;opacity:.6}
.lm-bulk-dialog{width:min(100%,460px);padding:22px;border:1px solid #dfe8e6;border-radius:8px;background:#fff;box-shadow:0 18px 60px rgba(19,44,43,.24)}
.lm-bulk-dialog h2{margin:0 0 6px;color:#193f42;font-size:18px}
.lm-bulk-dialog>p{margin:0 0 18px;color:#748587;font-size:12px}
.lm-bulk-file{display:grid;gap:8px;padding:18px;border:1px dashed #a9c3be;border-radius:6px;background:#f8fbfa;color:#52696b;font-size:11px;font-weight:700}
.lm-bulk-file input{width:100%;color:#52696b;font:inherit;font-weight:400}
.lm-bulk-selected{display:flex;align-items:center;gap:7px;overflow-wrap:anywhere;color:#315d5b;font-size:11px;font-weight:600}
.lm-bulk-progress{display:grid;gap:7px;margin-top:16px}
.lm-bulk-progress-meta{display:flex;justify-content:space-between;color:#52696b;font-size:10px;font-weight:700}
.lm-bulk-progress-track{height:9px;overflow:hidden;border-radius:99px;background:#e7efed}
.lm-bulk-progress-fill{height:100%;border-radius:inherit;background:#177e7a;transition:width .18s ease}
.lm-bulk-success{display:flex;align-items:flex-start;gap:8px;margin:14px 0 0!important;color:#267348!important;font-size:12px!important;font-weight:700}
.lm-bulk-error{margin:14px 0 0!important;color:#9d3030!important;font-size:11px!important;line-height:1.5}
.lm-bulk-row-errors{max-height:120px;overflow:auto;margin:8px 0 0;padding-left:24px;color:#8b5c20;font-size:10px;line-height:1.5}
.lm-bulk-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}
.lm-bulk-actions button{min-height:36px;padding:0 12px;border:1px solid #d2dfdc;border-radius:5px;background:#fff;color:#52696b;font-size:11px;font-weight:700;cursor:pointer}
.lm-bulk-actions button[type=submit]{border-color:#177e7a;background:#177e7a;color:#fff}
.lm-bulk-actions button:disabled{cursor:not-allowed;opacity:.6}
.lm-empty{padding:42px 18px!important;text-align:center!important;color:#718284!important}
.lm-load-error{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;padding:11px 13px;border:1px solid #efcaca;border-radius:5px;background:#fff5f5;color:#9d3030;font-size:12px}
.lm-load-error button{border:1px solid #d9aaaa;border-radius:4px;background:#fff;color:#8c3030;padding:6px 10px;font:inherit;font-weight:700;cursor:pointer}
.lm-pagination{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 14px;border-top:1px solid #e8eeec;color:#718284;font-size:10px}
.lm-pager{display:flex;align-items:center;gap:7px}
.lm-pager button{display:grid;place-items:center;width:30px;height:30px;border:1px solid #d8e3e1;border-radius:4px;background:#fff;color:#456567;cursor:pointer}
.lm-pager button:hover:not(:disabled){background:#f1f8f5}.lm-pager button:disabled{cursor:not-allowed;opacity:.45}
.lm-page-number{min-width:48px;text-align:center;color:#496163;font-weight:700}
@media(max-width:880px){.lm-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}.lm-filter-search{grid-column:1/-1}.lm-reset{justify-self:start}}
@media(max-width:540px){.lm-page{padding-top:0}.lm-page-header.page-header{align-items:flex-start;flex-direction:column;gap:12px}.lm-heading-actions{width:100%}.lm-heading-actions button{flex:1}.lm-toolbar{grid-template-columns:1fr;padding:12px}.lm-filter-search{grid-column:auto}.lm-reset{width:100%}.lm-results-meta{align-items:flex-start;flex-direction:column}.lm-pagination{align-items:flex-start;flex-direction:column}}
`;

const leadNoticeStyles = `
.lm-toast{position:fixed;top:50%;left:50%;right:auto;transform:translate(-50%,-50%);z-index:1400;display:flex;align-items:flex-start;gap:14px;width:max-content;max-width:min(420px,calc(100vw - 32px));padding:13px 15px;border:1px solid;border-radius:7px;box-shadow:0 12px 36px rgba(20,50,48,.18);font-size:12px;font-weight:650;line-height:1.5}
.lm-toast-success{border-color:#b9daca;background:#f1fbf4;color:#286746}
.lm-toast-error{border-color:#edc9c9;background:#fff5f5;color:#963838}
.lm-toast button{display:grid;place-items:center;flex:0 0 22px;width:22px;height:22px;padding:0;border:0;border-radius:4px;background:transparent;color:inherit;cursor:pointer}
.lm-toast button:hover{background:rgba(30,60,55,.08)}
`;

export function LeadManagementPage({ corporate = false }) {
  const [leads, setLeads] = useState([]);
  const [totalLeadCount, setTotalLeadCount] = useState(0);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const [leadStatusOptions, setLeadStatusOptions] = useState([]);
  const [lookupError, setLookupError] = useState('');
  const [showNewLead, setShowNewLead] = useState(false);
  const [editingCorporateLead, setEditingCorporateLead] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [importRowErrors, setImportRowErrors] = useState([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportMode, setExportMode] = useState('all');
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [assignmentLead, setAssignmentLead] = useState(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [openDatePicker, setOpenDatePicker] = useState(null);
  const fromDatePickerRef = useRef(null);
  const toDatePickerRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [notice, setNotice] = useState(null);

  const showNotice = (type, message) => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    setNotice({ type, message });
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 5000);
  };

  useEffect(() => {
    if (!openDatePicker) return undefined;

    const handleOutsidePointerDown = (event) => {
      if (
        !fromDatePickerRef.current?.contains(event.target)
        && !toDatePickerRef.current?.contains(event.target)
      ) {
        setOpenDatePicker(null);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [openDatePicker]);

  useEffect(() => () => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    setIsLoadingLeads(true);
    setLoadError('');

    const request = corporate
      ? Promise.resolve(getLeads())
        .then((records) => ({ items: records, totalElements: records.length }))
      : (fromDate || toDate
        ? getAllRetailLeads({
          status: statusFilter === 'All' ? '' : statusFilter,
          search: searchQuery,
        })
        : getRetailLeads({
          page: currentPage - 1,
          size: LEADS_PER_PAGE,
          status: statusFilter === 'All' ? '' : statusFilter,
          search: searchQuery,
        }));

    request
      .then(({ items, totalElements }) => {
        if (!isCurrent) return;
        setLeads(items.map(normalizeLeadRecord));
        setTotalLeadCount(totalElements);
      })
      .catch((error) => {
        if (isCurrent) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load leads.');
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoadingLeads(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [corporate, currentPage, statusFilter, searchQuery, fromDate, toDate, loadVersion]);

  useEffect(() => {
    let isCurrent = true;
    getRetailLookups()
      .then((lookups) => {
        if (!isCurrent) return;
        const statusLookupNames = ['Lead Status', 'Lead Statuses', 'Status'];
        const statusLookup = lookups.find((lookup) => statusLookupNames.some(
          (name) => String(lookup.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
            === name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        ));
        setLeadStatusOptions((statusLookup?.subLookups || [])
          .slice()
          .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0)));
        setLookupError('');
      })
      .catch((error) => {
        if (isCurrent) {
          setLookupError(error instanceof Error ? error.message : 'Unable to load lookup values.');
        }
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, fromDate, toDate]);

  const handleCreateLead = async (form) => {
    await createRetailLead(form);
    setLoadVersion((version) => version + 1);
    showNotice('success', 'Lead created successfully.');
  };

  const handleCorporateSaved = (form) => {
    const nextId = Math.max(...leads.map((lead) => Number(String(lead.id).replace(/\D/g, ''))), 0) + 1;
    const leadId = form.id || `CL${String(nextId).padStart(6, '0')}`;
    const savedLead = normalizeLeadRecord({
      ...form,
      id: leadId,
      leadId,
      leadType: 'CORPORATE',
      customerName: form.entityName,
      name: form.entityName,
    });
    const nextLeads = [savedLead, ...leads.filter((lead) => lead.id !== savedLead.id)];
    setLeads(saveLeads(nextLeads));
    setEditingCorporateLead(null);
  };

  const handleUpdateLead = async (form) => {
    if (!editingLead?.id) {
      throw new Error('The lead ID is missing.');
    }

    await updateRetailLead(editingLead.id, form);
    setLoadVersion((version) => version + 1);
    showNotice('success', 'Lead changes saved successfully.');
    setEditingLead(null);
  };

  const openAssignmentDialog = (lead) => {
    setAssignmentLead(lead);
    setAssigneeId(lead.assignedToId || '');
    setAssigneeName(lead.assignedToName || '');
  };

  const handleAssignLead = async (event) => {
    event.preventDefault();
    if (!assignmentLead || isAssigning) return;

    setIsAssigning(true);
    try {
      if (corporate) {
        const nextLeads = leads.map((lead) => (
          lead.id === assignmentLead.id
            ? normalizeLeadRecord({
              ...lead,
              assignedToId: assigneeId.trim(),
              assignedToName: assigneeName.trim(),
            })
            : lead
        ));
        setLeads(saveLeads(nextLeads));
      } else {
        await assignRetailLead(assignmentLead.id, {
          employeeId: assigneeId.trim(),
          employeeName: assigneeName.trim(),
        });
        setLoadVersion((version) => version + 1);
      }
      showNotice('success', corporate ? 'Lead assignment saved on this device.' : 'Lead assigned successfully.');
      setAssignmentLead(null);
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Unable to assign this lead.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRetryLoad = () => {
    setLoadVersion((version) => version + 1);
    if (lookupError) {
      getRetailLookups()
        .then((lookups) => {
          const statusLookup = lookups.find((lookup) => ['Lead Status', 'Lead Statuses', 'Status']
            .some((name) => String(lookup.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
              === name.toLowerCase().replace(/[^a-z0-9]/g, '')));
          setLeadStatusOptions((statusLookup?.subLookups || [])
            .slice()
            .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0)));
          setLookupError('');
        })
        .catch((error) => {
          setLookupError(error instanceof Error ? error.message : 'Unable to load lookup values.');
        });
    }
  };

  const handleExport = async (event, mode = exportMode) => {
    event?.preventDefault();
    if (isExporting) return;

    setExportError('');
    if (mode === 'date') {
      if (!exportFromDate || !exportToDate) {
        const message = 'Select both a start date and an end date.';
        setExportError(message);
        showNotice('error', message);
        return;
      }
      if (exportFromDate > exportToDate) {
        const message = 'The start date must be on or before the end date.';
        setExportError(message);
        showNotice('error', message);
        return;
      }
    }

    setIsExporting(true);
    try {
      if (mode === 'all') {
        if (isLoadingLeads) throw new Error('Wait for leads to finish loading, then try again.');
        const exportLeads = corporate ? activeLeads : (await getAllRetailLeads()).items;
        if (!exportLeads.length) throw new Error(`There are no ${corporate ? 'corporate ' : ''}leads to export.`);
        const csv = `\uFEFF${leadsToCsv(exportLeads)}`;
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), corporate ? 'corporate-leads.csv' : 'leads.csv');
      } else {
        if (isLoadingLeads) throw new Error('Wait for the leads to finish loading, then try again.');
        const exportLeads = corporate ? activeLeads : (await getAllRetailLeads()).items;
        const matchingLeads = exportLeads.filter((lead) => {
          const leadDate = toIsoDate(lead.date || lead.leadDate || lead.createdAt);
          return leadDate && leadDate >= exportFromDate && leadDate <= exportToDate;
        });
        if (!matchingLeads.length) throw new Error('No leads were found in the selected date range.');
        const csv = `\uFEFF${leadsToCsv(matchingLeads)}`;
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `leads-${exportFromDate}-to-${exportToDate}.csv`);
      }
      showNotice('success', 'Leads exported successfully.');
      setShowExportDialog(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to export leads.';
      setExportError(message);
      showNotice('error', message);
    } finally {
      setIsExporting(false);
    }
  };

  const openBulkImport = () => {
    setBulkFile(null);
    setImportProgress(0);
    setImportError('');
    setImportSuccess('');
    setImportRowErrors([]);
    setShowBulkImport(true);
  };

  const handleBulkFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setImportError('');
    setImportSuccess('');
    setImportRowErrors([]);
    if (file && !file.name.toLowerCase().endsWith('.csv')) {
      setBulkFile(null);
      event.target.value = '';
      const message = 'Choose a CSV (.csv) file.';
      setImportError(message);
      showNotice('error', message);
      return;
    }
    setBulkFile(file);
  };

  const handleBulkImport = async (event) => {
    event.preventDefault();
    if (!bulkFile || isImporting) return;

    setImportError('');
    setImportSuccess('');
    setImportProgress(0);
    setIsImporting(true);
    try {
      setImportProgress(25);
      const importedRecords = parseCsv(await bulkFile.text()).map((record, index) => {
        const parsed = Object.fromEntries(Object.entries(record).map(([key, value]) => {
          const text = value.trim();
          if (text.startsWith('{') || text.startsWith('[')) {
            try {
              return [key, JSON.parse(text)];
            } catch {
              return [key, value];
            }
          }
          return [key, value];
        }));
        const nextId = Math.max(...leads.map((lead) => Number(String(lead.id).replace(/\D/g, ''))), 0) + index + 1;
        const id = parsed.id || parsed.leadId || `LD${String(nextId).padStart(6, '0')}`;
        return normalizeLeadRecord({ ...parsed, id, leadId: id, status: parsed.status || 'New' });
      });
      const mergedLeads = [
        ...importedRecords.filter((record) => !leads.some((lead) => lead.id === record.id)),
        ...leads,
      ];
      setLeads(saveLeads(mergedLeads));
      setImportProgress(100);
      setImportSuccess(`Imported ${importedRecords.length} lead${importedRecords.length === 1 ? '' : 's'} to this device.`);
      showNotice('success', 'Leads imported to this device.');
      window.setTimeout(() => {
        setShowBulkImport(false);
        setBulkFile(null);
      }, 1800);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to import leads.';
      setImportError(message);
      showNotice('error', message);
    } finally {
      setIsImporting(false);
    }
  };

  const loadLeadDetails = async (lead) => {
    if (corporate) {
      setSelectedLead(lead);
      return;
    }

    try {
      const details = await getRetailLead(lead.id);
      setSelectedLead(normalizeLeadRecord({ ...lead, ...(details || {}) }));
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Unable to load lead details.');
    }
  };

  const openLeadEditor = async (lead) => {
    setSelectedLead(null);
    if (corporate) {
      setEditingCorporateLead(lead);
      return;
    }

    try {
      const details = await getRetailLead(lead.id);
      setEditingLead(normalizeLeadRecord({ ...lead, ...(details || {}) }));
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Unable to load lead details.');
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    setSearchQuery(searchInput.trim().toLowerCase());
  };
  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setStatusFilter('All');
    setFromDate('');
    setToDate('');
    setOpenDatePicker(null);
  };

  const todayDate = dateFromIso(dateToIso(new Date()));
  const selectedToDate = dateFromIso(toDate);
  const fromDateMax = selectedToDate && selectedToDate < todayDate ? selectedToDate : todayDate;
  const activeLeads = corporate ? leads.filter((lead) => isCorporateLead(lead)) : leads;
  const filteredLeads = activeLeads.filter((lead) => {
    const leadStatus = lead.status === 'Pending' ? 'New' : lead.status || 'New';
    const statusMatches = statusFilter === 'All'
      || leadStatus === statusFilter
      || lead.status === statusFilter
      || lead.leadStatus === statusFilter;
    const leadDate = toIsoDate(leadFieldValue(lead, 'date'));
    const fromMatches = !fromDate || Boolean(leadDate && leadDate >= fromDate);
    const toMatches = !toDate || Boolean(leadDate && leadDate <= toDate);
    const fieldValues = (corporate
      ? ['id', 'entityName', 'registrationNo', 'assignedBy', 'assignedToName']
      : ['id', 'customerName', 'mobileNumber', 'assignedBy', 'assignedToName']).map((field) => leadFieldValue(lead, field));
    const searchMatches = !searchQuery || fieldValues.some((value) => String(value ?? '').toLowerCase().includes(searchQuery));
    return statusMatches && fromMatches && toMatches && searchMatches;
  });
  const displayedLeadCount = !corporate && !fromDate && !toDate ? totalLeadCount : filteredLeads.length;
  const pageCount = Math.max(1, Math.ceil(displayedLeadCount / LEADS_PER_PAGE));
  const visiblePage = Math.min(currentPage, pageCount);
  const pageStart = displayedLeadCount ? (visiblePage - 1) * LEADS_PER_PAGE : 0;
  const paginatedLeads = corporate || fromDate || toDate
    ? filteredLeads.slice(pageStart, pageStart + LEADS_PER_PAGE)
    : filteredLeads;
  const pageEnd = Math.min(pageStart + paginatedLeads.length, displayedLeadCount);
  const tableColumns = corporate
    ? [['srNo', 'Sr. No.'], ['id', 'Lead ID'], ['entityName', 'Entity Name'], ['registrationNo', 'Registration No.'], ['assignedToName', 'Assigned To'], ['status', 'Status'], ['date', 'Lead Date']]
    : leadTableColumns;
  return (
    <>
      <AppShell title="Lead Management">
        <style>{leadManagementStyles}{leadNoticeStyles}</style>
        {!corporate && (showNewLead || Boolean(editingLead)) ? (
          <NewLead
            key={editingLead?.id || 'new-lead'}
            open
            initialData={editingLead}
            onClose={() => {
              setShowNewLead(false);
              setEditingLead(null);
            }}
            onCreate={handleCreateLead}
            onUpdate={handleUpdateLead}
          />
        ) : (
        <main className="lm-page">
          <PageHeader
            className="lm-page-header"
            title={corporate ? 'Corporate Lead Management' : 'Retail Lead Management'}
            description={corporate
              ? 'Manage corporate enquiries, qualification status, ownership, and lead dates.'
              : 'Manage retail enquiries, qualification status, ownership, and lead dates.'}
            marquee
            action={
              <div className="lm-heading-actions">
                <button type="button" className="lm-export-button" onClick={() => {
                  setExportMode('all');
                  setExportError('');
                  setShowExportDialog(true);
                }}><Download size={16} /> Export Lead</button>
                <button type="button" className="lm-add-button" onClick={() => corporate ? setEditingCorporateLead({}) : setShowNewLead(true)}><Plus size={16} /> Add Lead</button>
                <button type="button" className="lm-export-button" onClick={openBulkImport}><Upload size={16} /> Upload Bulk Lead</button>
              </div>
            }
          />

          {(loadError || lookupError) ? (
            <div className="lm-load-error" role="alert">
              <span>{loadError || lookupError}</span>
              <button type="button" onClick={handleRetryLoad}>Retry</button>
            </div>
          ) : null}

          <section className="lm-toolbar" aria-label="Lead filters">
            <label className="lm-filter lm-filter-search" htmlFor="lead-search-text">Search leads
              <span className="lm-search-box"><Search size={15} aria-hidden="true" /><input id="lead-search-text" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleSearch(); }} onBlur={handleSearch} placeholder="Lead ID, name, mobile or assignee" /></span>
            </label>
            <label className="lm-filter" htmlFor="lead-status-filter">Status
              <select id="lead-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="All">All Status</option>
                {leadStatusOptions.map((status, index) => {
                  const name = status.name || status.description || status.code || '';
                  return name ? <option key={status.id ?? status.code ?? index} value={name}>{name}</option> : null;
                })}
              </select>
            </label>
            <label className="lm-filter" htmlFor="lead-from-date">Lead date from
              <div ref={fromDatePickerRef} className="lm-date-picker" style={{ position: 'relative' }}>
                <button
                  id="lead-from-date"
                  type="button"
                  className="dob-picker-trigger"
                  aria-haspopup="dialog"
                  aria-expanded={openDatePicker === 'from'}
                  onClick={() => setOpenDatePicker((open) => open === 'from' ? null : 'from')}
                >
                  <span className={fromDate ? '' : 'dob-picker-placeholder'}>{formatFilterDate(fromDate)}</span>
                  <CalendarDays size={16} aria-hidden="true" />
                </button>
                {openDatePicker === 'from' ? (
                  <div className="dob-calendar-popover" role="dialog" aria-label="Choose lead start date">
                    <Calendar
                      className="loan-birth-calendar"
                      value={dateFromIso(fromDate)}
                      onChange={(date) => {
                        setFromDate(dateToIso(date));
                        setOpenDatePicker(null);
                      }}
                      maxDate={fromDateMax}
                      defaultActiveStartDate={dateFromIso(fromDate) || new Date()}
                      locale="en-IN"
                    />
                  </div>
                ) : null}
              </div>
            </label>
            <label className="lm-filter lm-filter-date-to" htmlFor="lead-to-date">Lead date to
              <div ref={toDatePickerRef} className="lm-date-picker" style={{ position: 'relative' }}>
                <button
                  id="lead-to-date"
                  type="button"
                  className="dob-picker-trigger"
                  aria-haspopup="dialog"
                  aria-expanded={openDatePicker === 'to'}
                  onClick={() => setOpenDatePicker((open) => open === 'to' ? null : 'to')}
                >
                  <span className={toDate ? '' : 'dob-picker-placeholder'}>{formatFilterDate(toDate)}</span>
                  <CalendarDays size={16} aria-hidden="true" />
                </button>
                {openDatePicker === 'to' ? (
                  <div className="dob-calendar-popover" role="dialog" aria-label="Choose lead end date">
                    <Calendar
                      className="loan-birth-calendar"
                      value={dateFromIso(toDate)}
                      minDate={dateFromIso(fromDate) || undefined}
                      maxDate={todayDate}
                      onChange={(date) => {
                        setToDate(dateToIso(date));
                        setOpenDatePicker(null);
                      }}
                      defaultActiveStartDate={dateFromIso(toDate) || dateFromIso(fromDate) || new Date()}
                      locale="en-IN"
                    />
                  </div>
                ) : null}
              </div>
            </label>
            {(searchInput || statusFilter !== 'All' || fromDate || toDate) && <button type="button" className="lm-reset" onClick={clearFilters}><X size={14} /> Clear filters</button>}
          </section>

          <section className="lm-results" aria-label="Lead records">
            <div className="lm-results-meta"><strong>{displayedLeadCount} {displayedLeadCount === 1 ? 'lead' : 'leads'}</strong><span>{corporate ? 'Search covers lead ID, entity name, registration number, and assignee.' : 'Search covers lead ID, customer name, mobile number, and assignee.'}</span></div>
            <div className="lm-table-wrap">
              <table className="lm-table">
                <thead><tr>{tableColumns.map(([, label]) => <th key={label}>{label}</th>)}<th>Actions</th></tr></thead>
                <tbody>
                  {isLoadingLeads ? <tr><td className="lm-empty" colSpan={tableColumns.length + 1}>Loading leads...</td></tr>
                  : paginatedLeads.length ? paginatedLeads.map((lead, rowIndex) => (
                    <tr key={lead.id}>
                      {tableColumns.map(([field]) => (
                        <td key={field} className={field === 'id' ? 'lm-id' : undefined}>
                          {field === 'srNo'
                            ? pageStart + rowIndex + 1
                            : field === 'status'
                            ? <span className={`lm-status status-${lead.statusKey || statusKeys[lead.status] || 'new'}`}>{lead.status === 'Pending' ? 'New' : lead.status || 'New'}</span>
                            : String(leadFieldValue(lead, field) ?? '—')}
                        </td>
                      ))}
                      <td><div className="lm-actions">
                        <button type="button" className="lm-action" onClick={() => loadLeadDetails(lead)} aria-label={`View lead ${lead.id}`} title="View lead"><Eye size={14} /></button>
                        <button type="button" className="lm-action" onClick={() => corporate ? setEditingCorporateLead(lead) : openLeadEditor(lead)} aria-label={`Edit lead ${lead.id}`} title="Edit lead"><Pencil size={14} /></button>
                      <button type="button" className="lm-action" onClick={() => openAssignmentDialog(lead)} aria-label={`Assign lead ${lead.id}`} title="Assign lead">Assigned</button>
                      </div></td>
                    </tr>
                  )) : <tr><td className="lm-empty" colSpan={tableColumns.length + 1}>No leads match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <footer className="lm-pagination">
              <span>Showing {filteredLeads.length ? pageStart + 1 : 0}–{pageEnd} of {filteredLeads.length}</span>
              <div className="lm-pager">
                <button aria-label="Previous page" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={visiblePage === 1}><ChevronLeft size={15} /></button>
                <span className="lm-page-number">{visiblePage} / {pageCount}</span>
                <button aria-label="Next page" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={visiblePage === pageCount}><ChevronRight size={15} /></button>
              </div>
            </footer>
          </section>
        </main>
        )}
      </AppShell>

      {notice ? (
        <div className={`lm-toast lm-toast-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'} aria-live={notice.type === 'error' ? 'assertive' : 'polite'}>
          <span>{notice.message}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => {
            if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
            setNotice(null);
          }}><X size={15} /></button>
        </div>
      ) : null}

      {corporate ? (
        <CorporateLeadWizard
          open={Boolean(editingCorporateLead)}
          initialData={editingCorporateLead}
          onClose={() => setEditingCorporateLead(null)}
          onSaved={handleCorporateSaved}
        />
      ) : null}
      <LeadDetails
        lead={selectedLead}
        open={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        onEdit={(lead) => {
          setSelectedLead(null);
          if (corporate) setEditingCorporateLead(lead);
          else openLeadEditor(lead);
        }}
      />
      {showExportDialog ? (
        <div className="lm-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isExporting) setShowExportDialog(false);
        }}>
          <form className="lm-export-dialog" onSubmit={handleExport} role="dialog" aria-modal="true" aria-labelledby="lm-export-title">
            <h2 id="lm-export-title">Export Leads</h2>
            <p>Download lead data as a CSV file that opens in Excel.</p>
            <div className="lm-export-options">
              <button type="button" className={`lm-export-option${exportMode === 'all' ? ' selected' : ''}`} disabled={isExporting} onClick={() => {
                setExportMode('all');
                setExportError('');
                handleExport(null, 'all');
              }}>
                <FileSpreadsheet size={18} />
                <strong>Export All</strong>
                <span>{corporate ? 'Download all corporate leads saved on this device.' : 'Download all retail leads from the service.'}</span>
              </button>
              <button type="button" className={`lm-export-option${exportMode === 'date' ? ' selected' : ''}`} disabled={isExporting} onClick={() => {
                setExportMode('date');
                setExportError('');
              }}>
                <CalendarDays size={18} />
                <strong>Export by Date</strong>
                <span>Choose a date range to export matching leads.</span>
              </button>
            </div>
            {exportMode === 'date' ? (
              <div className="lm-export-dates">
                <label htmlFor="lead-export-from">From
                  <LeadDatePicker
                    id="lead-export-from"
                    name="exportFromDate"
                    label="export start date"
                    value={exportFromDate}
                    max={exportToDate}
                    onChange={setExportFromDate}
                    disabled={isExporting}
                    required
                  />
                </label>
                <label htmlFor="lead-export-to">To
                  <LeadDatePicker
                    id="lead-export-to"
                    name="exportToDate"
                    label="export end date"
                    value={exportToDate}
                    min={exportFromDate}
                    onChange={setExportToDate}
                    disabled={isExporting}
                    required
                  />
                </label>
              </div>
            ) : null}
            {exportError ? <p className="lm-export-error" role="alert">{exportError}</p> : null}
            <div className="lm-export-actions">
              <button type="button" onClick={() => setShowExportDialog(false)} disabled={isExporting}>Cancel</button>
              {exportMode === 'date' ? <button type="submit" disabled={isExporting}>{isExporting ? 'Exporting...' : 'Export Now'}</button> : null}
            </div>
          </form>
        </div>
      ) : null}
      {showBulkImport ? (
        <div className="lm-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isImporting) setShowBulkImport(false);
        }}>
          <form className="lm-bulk-dialog" onSubmit={handleBulkImport} role="dialog" aria-modal="true" aria-labelledby="lm-bulk-title">
            <h2 id="lm-bulk-title">Upload Bulk Leads</h2>
            <p>Select a CSV file using the lead import template.</p>
            {!importSuccess ? (
              <label className="lm-bulk-file" htmlFor="bulk-leads-file">
                CSV file
                <input id="bulk-leads-file" type="file" accept=".csv,text/csv" onChange={handleBulkFileChange} disabled={isImporting} />
                {bulkFile ? <span className="lm-bulk-selected"><FileSpreadsheet size={15} /> {bulkFile.name} ({(bulkFile.size / 1024).toFixed(1)} KB)</span> : null}
              </label>
            ) : null}
            {isImporting || importSuccess ? (
              <div className="lm-bulk-progress" role="status" aria-live="polite">
                <div className="lm-bulk-progress-meta"><span>{importSuccess ? 'Import complete' : 'Importing leads...'}</span><span>{importProgress}%</span></div>
                <div className="lm-bulk-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={importProgress} aria-label="Lead import progress">
                  <div className="lm-bulk-progress-fill" style={{ width: `${importProgress}%` }} />
                </div>
              </div>
            ) : null}
            {importSuccess ? <p className="lm-bulk-success"><CheckCircle2 size={17} />{importSuccess}</p> : null}
            {importRowErrors.length ? <ul className="lm-bulk-row-errors">{importRowErrors.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}</ul> : null}
            {importError ? <p className="lm-bulk-error" role="alert">{importError}</p> : null}
            <div className="lm-bulk-actions">
              {!importSuccess ? <button type="button" onClick={() => setShowBulkImport(false)} disabled={isImporting}>Cancel</button> : null}
              {!importSuccess ? <button type="submit" disabled={!bulkFile || isImporting}>{isImporting ? `Importing ${importProgress}%` : 'Import Now'}</button> : null}
            </div>
          </form>
        </div>
      ) : null}
      {assignmentLead ? (
        <div className="lm-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isAssigning) setAssignmentLead(null);
        }}>
          <form className="lm-assignment-dialog" onSubmit={handleAssignLead} role="dialog" aria-modal="true" aria-labelledby="lm-assignment-title">
            <h2 id="lm-assignment-title">Assign Lead</h2>
            <p>Enter an assignee for lead {assignmentLead.id}.</p>
            <label htmlFor="lead-assignee-name">Assignee name
              <input id="lead-assignee-name" value={assigneeName} onChange={(event) => setAssigneeName(event.target.value)} required disabled={isAssigning} />
            </label>
            <label htmlFor="lead-assignee-id">Employee ID
              <input id="lead-assignee-id" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} required disabled={isAssigning} />
            </label>
            <div className="lm-assignment-actions">
              <button type="button" onClick={() => setAssignmentLead(null)} disabled={isAssigning}>Cancel</button>
              <button type="submit" disabled={isAssigning || !assigneeName.trim() || !assigneeId.trim()}>{isAssigning ? 'Saving...' : 'Assign'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

const isCorporateLead = (lead) => {
  const leadType = [lead?.leadType, lead?.entityType, lead?.customerType, lead?.organizationType]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return leadType.includes('corporate')
    || Boolean(lead?.entityName || lead?.organizationName || lead?.legalName);
};

export default function RetailLeadManagementPage() {
  return <LeadManagementPage />;
}