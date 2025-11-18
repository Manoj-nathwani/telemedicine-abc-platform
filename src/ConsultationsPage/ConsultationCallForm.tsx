import React, { type FC } from "react";
import { Button, Col, Row } from 'react-bootstrap';
import { ConsultationSection, ConsultationLabel, ConsultationCheckbox } from './utils';
import { type ConsultationWithCalls, type ConsultationCallStatus } from '../consultations/types';
import { createConsultationCall } from 'wasp/client/operations';
import { format } from '../utils/dateTime';

const callStatusOptions: { id: ConsultationCallStatus; label: string }[] = [
    { id: 'patient_answered', label: "Patient answered the phone" },
    { id: 'patient_no_answer', label: "Patient did not answer the phone" },
    { id: 'clinician_did_not_call', label: "Clinician did not call the patient" },
];

type Props = {
    consultation: ConsultationWithCalls;
    onCallCreated: () => void;
};

export const ConsultationCallForm: FC<Props> = ({ consultation, onCallCreated }) => {
    const [callStatus, setCallStatus] = React.useState<ConsultationCallStatus | null>(null);
    const [safeLocationChecked, setSafeLocationChecked] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [outcome, setOutcome] = React.useState({
        chiefComplaint: '',
        reviewOfSystems: '',
        pastMedicalHistory: '',
        diagnosis: '',
        labTests: '',
        prescriptions: '',
        safetyNetting: '',
        followUp: '',
        additionalNotes: '',
    });

    if (callStatus === null) {
        return (
            <ConsultationSection className={`border border-primary rounded p-3 w-75 ${consultation.patient ? 'mt-3' : ''}`}>
                <ConsultationLabel text="Phone Call" />
                <div className="d-flex flex-column gap-2">
                    {callStatusOptions.map(({ id, label }) => (
                        <ConsultationCheckbox
                            key={id}
                            label={label}
                            checked={callStatus === id}
                            onChange={() => setCallStatus(id)}
                        />
                    ))}
                </div>
            </ConsultationSection>
        )
    }

    function PatientAnsweredCheckbox({ label }: { label: string }) {
        return (
            <ConsultationCheckbox
                label={label}
                checked={true}
                onChange={() => setCallStatus(null)}
            />
        )
    }

    const handleSubmit = async () => {
        if (!callStatus) return;

        setIsSubmitting(true);
        try {
            // Build confirmations array based on call status and checks
            const confirmations: string[] = [];

            if (callStatus === 'patient_answered') {
                confirmations.push("Patient answered the phone");

                if (consultation.patient) {
                    confirmations.push(`Patient is ${consultation.patient.name}, born ${format(consultation.patient.dateOfBirth, { dateStyle: 'medium' })}`);
                }

                if (safeLocationChecked) {
                    confirmations.push("Patient has confirmed that they are in a safe, private location where they can discuss their medical concerns freely without being overheard");
                }
            }

            // Submit call with all data in single action
            const callData: any = {
                consultationId: consultation.id,
                status: callStatus,
            };

            // Include patientId for successful calls (required)
            if (callStatus === 'patient_answered' && consultation.patient) {
                callData.patientId = consultation.patient.id;
            }

            // Only include optional fields if they have values
            if (confirmations.length > 0) {
                callData.confirmations = confirmations;
            }
            Object.entries(outcome).forEach(([key, value]) => {
                if (value) callData[key] = value;
            });

            await createConsultationCall(callData);

            // Reset form state
            setCallStatus(null);
            setSafeLocationChecked(false);
            setOutcome({
                chiefComplaint: '',
                reviewOfSystems: '',
                pastMedicalHistory: '',
                diagnosis: '',
                labTests: '',
                prescriptions: '',
                safetyNetting: '',
                followUp: '',
                additionalNotes: '',
            });

            onCallCreated();
        } catch (error) {
            console.error('Failed to create call:', error);
            alert('Failed to create call. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    function NotesAndSubmitButton() {
        return (
            <>
                <ConsultationSection>
                    <ConsultationLabel text="Additional Notes" />
                    <textarea
                        className="form-control border-primary-subtle shadow-none"
                        rows={4}
                        value={outcome.additionalNotes}
                        onChange={(e) => setOutcome({ ...outcome, additionalNotes: e.target.value })}
                    />
                </ConsultationSection>
                <ConsultationSection>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                    </Button>
                </ConsultationSection>
            </>
        )
    }

    switch (callStatus) {
        case "patient_answered":
            return (
                <>
                    <ConsultationSection>
                        <PatientAnsweredCheckbox label="Patient answered the phone" />
                        <ConsultationCheckbox
                            label="Patient has confirmed that they are in a safe, private location where they can discuss their medical concerns freely without being overheard"
                            checked={safeLocationChecked}
                            onChange={() => setSafeLocationChecked(!safeLocationChecked)}
                        />
                    </ConsultationSection>

                    {consultation.patient && safeLocationChecked && (
                        <>
                            <ConsultationSection>
                                {([
                                    ['chiefComplaint', 'Chief Complaint', 'reviewOfSystems', 'Review of Systems'],
                                    ['pastMedicalHistory', 'Past Medical History', 'diagnosis', 'Diagnosis'],
                                    ['labTests', 'Lab Tests', 'prescriptions', 'Prescriptions'],
                                    ['safetyNetting', 'Safety Netting', 'followUp', 'Follow-up'],
                                ] as const).map(([field1, label1, field2, label2], idx) => (
                                    <ConsultationSection key={idx} className="mb-4">
                                        <Row className="g-5">
                                            <Col md={6}>
                                                <ConsultationLabel text={label1} />
                                                <textarea
                                                    className="form-control border-primary-subtle shadow-none"
                                                    rows={4}
                                                    value={outcome[field1]}
                                                    onChange={(e) => setOutcome({ ...outcome, [field1]: e.target.value })}
                                                />
                                            </Col>
                                            <Col md={6}>
                                                <ConsultationLabel text={label2} />
                                                <textarea
                                                    className="form-control border-primary-subtle shadow-none"
                                                    rows={4}
                                                    value={outcome[field2]}
                                                    onChange={(e) => setOutcome({ ...outcome, [field2]: e.target.value })}
                                                />
                                            </Col>
                                        </Row>
                                    </ConsultationSection>
                                ))}
                            </ConsultationSection>
                            <NotesAndSubmitButton />
                        </>
                    )}
                </>
            )
        case "patient_no_answer":
            return (
                <>
                    <ConsultationSection>
                        <PatientAnsweredCheckbox label="Patient did not answer the phone" />
                    </ConsultationSection>
                    <NotesAndSubmitButton />
                </>
            )
        case "clinician_did_not_call":
            return (
                <>
                    <ConsultationSection>
                        <PatientAnsweredCheckbox label="Clinician did not call the patient" />
                    </ConsultationSection>
                    <NotesAndSubmitButton />
                </>
            )
        default:
            return null;
    }

};
