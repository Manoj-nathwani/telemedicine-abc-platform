import React, { useState, useMemo } from 'react';
import { useQuery, getPatientsWithConsultations } from 'wasp/client/operations';
import { Row, Col, Card, Table, Form } from 'react-bootstrap';
import { PageHeader, Loading, SmsMessageHistoryOffcanvas } from '../components';
import { format } from '../utils/dateTime';
import { Link } from 'react-router-dom';
import { getConsultationUrl } from '../routes';
import pluralize from 'pluralize';

export function PatientsPage() {
  const [search, setSearch] = useState('');
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>('');

  const { data: patients, isLoading } = useQuery(getPatientsWithConsultations);

  // Client-side filtering
  const filteredPatients = useMemo(() => {
    if (!patients || !search.trim()) {
      return patients || [];
    }

    const searchLower = search.toLowerCase();
    return patients.filter((patient: any) => {
      const idMatch = String(patient.id).includes(searchLower);
      const nameMatch = patient.name.toLowerCase().includes(searchLower);
      const dobMatch = format(patient.dateOfBirth, { dateStyle: 'medium' })
        .toLowerCase()
        .includes(searchLower);

      return idMatch || nameMatch || dobMatch;
    });
  }, [patients, search]);

  return (
    <Row>
      <Col>
        <PageHeader title="Patients" subtitle="View all patients and their consultations" />

        <Card className="shadow-sm">
          <Card.Body>
            <Form.Group className="mb-3 w-50">
              <Form.Control
                type="text"
                placeholder="Search by ID, name, or date of birth..."
                className="m-0"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Form.Group>
            {(() => {
              if (isLoading) {
                return <Loading />;
              } else if (!filteredPatients || filteredPatients.length === 0) {
                if (search) {
                  return (
                    <div className="text-center text-muted py-4">
                      No patients found matching your search
                    </div>
                  );
                }
                return null;
              } else {
                return (
                  <Table responsive bordered className="mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        {[
                          'Name',
                          'Date of Birth',
                          'Consultations',
                          'Phone Numbers'
                        ].map((header: string) => (
                          <th key={header} className="fw-normal">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPatients.map((patient: any) => {
                        // Extract unique phone numbers from consultations
                        const phones = new Set<string>();
                        patient.consultations?.forEach((consultation: any) => {
                          if (consultation.consultationRequest?.phoneNumber) {
                            phones.add(consultation.consultationRequest.phoneNumber);
                          }
                        });
                        const uniquePhoneNumbers = Array.from(phones).sort();

                        return (
                          <tr key={patient.id}>
                            <td>{patient.name}</td>
                            <td>{format(patient.dateOfBirth, { dateStyle: 'medium' })}</td>
                            <td>
                              {patient.consultations.length > 0 ? (
                                <details>
                                  <summary className="cursor-pointer text-primary">
                                    {patient.consultations.length} {pluralize('consultation', patient.consultations.length)}
                                  </summary>
                                  <ul className="text-primary">
                                    {patient.consultations.map((consultation: any) => (
                                      <li key={consultation.id}>
                                        <Link
                                          to={getConsultationUrl(consultation.id)}
                                          className="text-decoration-none small"
                                        >
                                          {format(consultation.createdAt, {
                                            dateStyle: 'short',
                                            timeStyle: 'short'
                                          })}
                                        </Link>
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td>
                              {uniquePhoneNumbers.length > 0 ? (
                                <details>
                                  <summary className="cursor-pointer text-primary">
                                    {uniquePhoneNumbers.length} {pluralize('phone number', uniquePhoneNumbers.length)}
                                  </summary>
                                  <ul className="text-primary">
                                    {uniquePhoneNumbers.map((phoneNumber: string) => (
                                      <li key={phoneNumber}>
                                        <button
                                          type="button"
                                          className="border-0 bg-transparent p-0 text-decoration-none text-start small text-primary"
                                          style={{
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                          }}
                                          onClick={() => setSelectedPhoneNumber(phoneNumber)}
                                        >
                                          {phoneNumber}
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                );
              }
            })()}
          </Card.Body>
        </Card>

        <SmsMessageHistoryOffcanvas
          show={!!selectedPhoneNumber}
          onHide={() => setSelectedPhoneNumber('')}
          phoneNumber={selectedPhoneNumber}
        />
      </Col>
    </Row>
  );
}
