'use client';

import { LoanApplicationFormPage } from './GoldLoanApplication';

export default function GoldLoanApplicationView({
  application,
  onBack,
  backLabel = 'Loan Dashboard',
}) {
  return (
    <LoanApplicationFormPage
      application={application}
      onBack={onBack}
      backLabel={backLabel}
      readOnly
    />
  );
}
