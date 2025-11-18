import React, { useState, type FC } from "react";
import { useQuery, useAction } from 'wasp/client/operations';
import { searchPatientsQuery, assignPatientToConsultation, clearPatientFromConsultation } from 'wasp/client/operations';
import { formatDateOnly } from '../utils/dateTime';
import { FormFieldRenderer } from '../components/FormFieldRenderer';
import { ConsultationCheckbox, ConsultationSection } from './utils';

type PatientIdentitySelectorProps = {
  phoneNumber: string;
  consultationId: number;
  patient?: { name: string; dateOfBirth: Date } | null;
  onSave: () => void;
};

export const PatientIdentitySelector: FC<PatientIdentitySelectorProps> = ({
  phoneNumber, consultationId, patient, onSave
}) => {
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [newPatientName, setNewPatientName] = useState("");
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const assignPatient = useAction(assignPatientToConsultation);
  const clearPatient = useAction(clearPatientFromConsultation);

  // Search for patients with this DOB and phone number
  const { data: patients, isLoading } = useQuery(
    searchPatientsQuery,
    { phoneNumber, dateOfBirth },
    { enabled: !patient && !!dateOfBirth && dateOfBirth.split('-').every(p => p) }
  );

  const handleClearPatient = async () => {
    try {
      await clearPatient({ consultationId });
      onSave();
    } catch (error) {
      console.error('Failed to clear patient:', error);
    }
  };

  // If patient exists, show checkbox confirmation
  if (patient) {
    return (
      <ConsultationCheckbox
        label={`Patient is ${patient.name}, born ${formatDateOnly(patient.dateOfBirth)}`}
        checked={true}
        onChange={handleClearPatient}
      />
    );
  }

  const handleDateChange = (value: string) => {
    setDateOfBirth(value);
    // Reset patient selection when date changes
    setSelectedPatientId(null);
    setNewPatientName("");
    setIsNewPatient(false);
  };

  const handleSave = async () => {
    if (!dateOfBirth) return;

    setIsSaving(true);
    try {
      await assignPatient({
        consultationId,
        selectedPatientId,
        newPatientName: newPatientName || null,
        dateOfBirth
      });
      onSave();
    } catch (error) {
      console.error('Failed to assign patient:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ConsultationSection>
      <div className="border border-primary rounded p-3 w-75">
        <div className="text-muted small mb-2">Date of Birth</div>
        <FormFieldRenderer
          field={{
            key: 'dateOfBirth',
            label: 'Date of Birth',
            type: 'dateSelects'
          }}
          value={dateOfBirth}
          onChange={handleDateChange}
          error={undefined}
        />

        {dateOfBirth && dateOfBirth.split('-').every(p => p) && (
          <div className="mt-4">
            <div className="text-muted small mb-2">Name</div>
            {isLoading && <div className="text-muted small">Searching patients...</div>}

            {!isLoading && patients && patients.length > 0 && (
              <div className="mb-2">
                {patients.map((patient: any) => (
                  <div key={patient.id} className="form-check mb-2">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="patientSelection"
                      id={`patient-${patient.id}`}
                      checked={selectedPatientId === patient.id}
                      onChange={() => {
                        setSelectedPatientId(patient.id);
                        setNewPatientName("");
                        setIsNewPatient(false);
                      }}
                    />
                    <label className="form-check-label" htmlFor={`patient-${patient.id}`}>
                      {patient.name}
                    </label>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && (
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="radio"
                  name="patientSelection"
                  id="new-patient"
                  checked={isNewPatient}
                  onChange={() => {
                    setIsNewPatient(true);
                    setSelectedPatientId(null);
                  }}
                />
                <input
                  type="text"
                  className="form-control border-primary-subtle shadow-none d-inline-block w-auto ms-2"
                  placeholder="New patient name"
                  value={newPatientName}
                  onChange={(e) => {
                    setNewPatientName(e.target.value);
                    setIsNewPatient(true);
                    setSelectedPatientId(null);
                  }}
                  onFocus={() => {
                    setIsNewPatient(true);
                    setSelectedPatientId(null);
                  }}
                />
              </div>
            )}

            {!isLoading && (selectedPatientId !== null || (isNewPatient && newPatientName !== "")) && (
              <button
                className="btn btn-primary mt-2"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        )}
      </div>
    </ConsultationSection>
  );
};
