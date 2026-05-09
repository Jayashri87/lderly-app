import LegalPage from "../LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" eyebrow="Privacy">
      <p>
        LDERLY collects account, booking, care recipient, caregiver, payment, location,
        support, and care update information to coordinate elder care services.
      </p>
      <p>
        Health notes, medicines, allergies, mobility information, reports, voice notes,
        and emergency contacts are treated as sensitive care information and are used
        only for care coordination, safety, support, legal compliance, and service quality.
      </p>
      <p>
        Access is restricted by role. Customers can access their family care data,
        caregivers can access assigned care data, and operations users can access data
        needed for dispatch, escalation, support, and quality review.
      </p>
      <p>
        Production launch requires final legal review, data retention rules, vendor DPAs,
        and India-specific consent language before public onboarding.
      </p>
    </LegalPage>
  );
}
