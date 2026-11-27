'use client';

import RetailLoanApplicationForm from './RetailLoanApplicationForm';

export default function RetailLoanApplicationView({
  application,
  onBack,
  backLabel = 'Loan Dashboard',
}) {
  return (
    <RetailLoanApplicationForm
      application={application}
      onBack={onBack}
      backLabel={backLabel}
      readOnly
    />
  );
}
