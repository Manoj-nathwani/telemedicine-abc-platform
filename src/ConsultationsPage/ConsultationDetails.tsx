import React, { type FC, useState } from "react";
import { format } from "../utils/dateTime";
import { type ConsultationWithCalls } from "../consultations/types";
import { PageHeader, ConsultationRequestTimeline, UserDisplay } from "../components";
import { formatPhoneNumber } from "../utils/helpers";
import { PatientIdentitySelector } from "./PatientIdentitySelector";
import { ConsultationCallForm } from "./ConsultationCallForm";
import { ConsultationSection, ConsultationLabel } from "./utils";
import { CONSULTATION_CALL_STATUS_LABELS } from "../consultations/types";
import { Button } from "react-bootstrap";
import { SmsMessageHistoryOffcanvas } from "../components/SmsMessageHistory";

type Props = {
  consultation: ConsultationWithCalls;
  onRefetch: () => void;
};

const ConsultationDetails: FC<Props> = ({ consultation, onRefetch }) => {
  const c = consultation;
  const [showSmsHistory, setShowSmsHistory] = useState(false);

  return (
    <>
      <ConsultationSection>
        <PageHeader
          className="mb-0"
          title={formatPhoneNumber(c.consultationRequest.phoneNumber)}
        >
          <Button variant="primary" onClick={() => setShowSmsHistory(true)}>
            <i className="bi bi-whatsapp me-2"></i>
            SMS
          </Button>
        </PageHeader>
      </ConsultationSection>

      <SmsMessageHistoryOffcanvas
        show={showSmsHistory}
        onHide={() => setShowSmsHistory(false)}
        phoneNumber={c.consultationRequest.phoneNumber}
      />

      <ConsultationSection>
        <ConsultationRequestTimeline
          createdAt={c.consultationRequest.createdAt}
          status="accepted"
          statusActionedAt={c.consultationRequest.statusActionedAt}
          statusActionedBy={c.consultationRequest.statusActionedBy}
          consultation={{
            id: c.id,
            slot: {
              startDateTime: c.slot.startDateTime,
              user: c.slot.user
            }
          }}
          phoneNumber={c.consultationRequest.phoneNumber}
        />
      </ConsultationSection>

      <ConsultationSection>
        <ConsultationLabel text="SMS Message" />
        <textarea
          value={c.consultationRequest.description}
          className="form-control border-primary-subtle shadow-none bg-primary-subtle"
          style={{ resize: 'none' }}
          rows={3}
          readOnly
        />
      </ConsultationSection>

      {c.calls && c.calls.length > 0 &&
        c.calls.map((call) => {
          const callLabel = `${format(call.createdAt, { timeStyle: 'short' })} - ${CONSULTATION_CALL_STATUS_LABELS[call.status]}`;
          const fields = [
            { label: 'Clinician', value: <UserDisplay user={call.conductedBy} /> },
            {
              label: 'Confirmations',
              value: call.confirmations && call.confirmations.length > 0 && (
                <div className="p-2">
                  <ul className="m-0 ps-3">
                    {call.confirmations.map((conf, idx) => (
                      <li key={idx}>{conf}</li>
                    ))}
                  </ul>
                </div>
              )
            },
            { label: 'Chief Complaint', value: call.chiefComplaint },
            { label: 'Review of Systems', value: call.reviewOfSystems },
            { label: 'Past Medical History', value: call.pastMedicalHistory },
            { label: 'Diagnosis', value: call.diagnosis },
            { label: 'Lab Tests', value: call.labTests },
            { label: 'Prescriptions', value: call.prescriptions },
            { label: 'Safety Netting', value: call.safetyNetting },
            { label: 'Follow-up', value: call.followUp },
            { label: 'Additional Notes', value: call.additionalNotes },
          ];

          return (
            <details key={call.id} className="mb-2" open={c.calls.length === 1}>
              <summary className="text-primary small mb-2" style={{ cursor: 'pointer' }}>
                {callLabel}
              </summary>
              <table className="table table-sm table-bordered small">
                <tbody>
                  {fields
                    .filter((field) => {
                      // Filter out empty fields
                      if (typeof field.value === 'string') {
                        return field.value.trim().length > 0;
                      }
                      // For React elements (like Confirmations), keep if truthy
                      return !!field.value;
                    })
                    .map((field, idx) => (
                      <tr key={idx}>
                        <td className="bg-light w-25">{field.label}</td>
                        <td>{field.value}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </details>
          );
        })}

      <details open={!c.calls || c.calls.length === 0}>
        <summary className="text-primary small mb-2" style={{ cursor: 'pointer' }}>
          New Call
        </summary>
        <PatientIdentitySelector
          phoneNumber={c.consultationRequest.phoneNumber}
          consultationId={c.id}
          patient={c.patient || null}
          onSave={onRefetch}
        />
        <ConsultationCallForm consultation={c} onCallCreated={onRefetch} />
      </details>

    </>
  );
};

export default ConsultationDetails; 