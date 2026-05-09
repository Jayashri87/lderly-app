import LegalPage from "../LegalPage";

export default function RefundsPage() {
  return (
    <LegalPage title="Cancellation and Refund Policy" eyebrow="Refunds">
      <p>
        Cancellation and refund eligibility depends on booking status, caregiver
        assignment, travel start, service completion, payment status, and the reason
        for cancellation.
      </p>
      <p>
        Refund requests are logged with the booking and reviewed by operations. Approved
        refunds are processed through the payment provider back to the original method
        wherever supported.
      </p>
      <p>
        Emergency, overnight, hospital, and already-started sessions may have different
        cancellation terms due to caregiver commitment and operational cost.
      </p>
      <p>
        Final refund rules must be reviewed with finance and legal before public launch.
      </p>
    </LegalPage>
  );
}
