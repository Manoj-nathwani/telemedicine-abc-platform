import React, { useState, useEffect } from 'react';
import { Offcanvas, Badge, InputGroup, Form, Button, Table } from 'react-bootstrap';
import { useQuery } from 'wasp/client/operations';
import { getAuditLogsByEntity } from 'wasp/client/operations';
import { format } from '../../utils/dateTime';
import { Loading } from '../../components';
import DataField from '../../components/DataField';

interface EntityAuditHistoryOffcanvasProps {
  show: boolean;
  onHide: () => void;
  initialEntityType?: string;
  initialEntityId?: number;
}

const ENTITY_TYPES = [
  'User',
  'Patient',
  'ConsultationRequest',
  'Slot',
  'Consultation',
  'ConsultationCall',
  'OutgoingSmsMessage',
  'Config',
];

export function EntityAuditHistoryOffcanvas({
  show,
  onHide,
  initialEntityType,
  initialEntityId
}: EntityAuditHistoryOffcanvasProps) {
  const [entityType, setEntityType] = useState(initialEntityType || 'User');
  const [entityId, setEntityId] = useState(initialEntityId?.toString() || '');
  const [queryParams, setQueryParams] = useState<{ entityType: string; entityId: number } | null>(null);

  // Update local state when initial props change
  useEffect(() => {
    if (initialEntityType) setEntityType(initialEntityType);
    if (initialEntityId) setEntityId(initialEntityId.toString());
    if (initialEntityType && initialEntityId) {
      setQueryParams({ entityType: initialEntityType, entityId: initialEntityId });
    }
  }, [initialEntityType, initialEntityId]);

  const { data: entityLogs, isLoading } = useQuery(
    getAuditLogsByEntity,
    queryParams!,
    { enabled: show && !!queryParams }
  );

  const handleSearch = () => {
    const id = parseInt(entityId);
    if (entityType && !isNaN(id) && id > 0) {
      setQueryParams({ entityType, entityId: id });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getEventTypeBadge = (eventType: string) => {
    if (eventType === 'CREATE') {
      return <Badge bg="success">{eventType}</Badge>;
    } else if (eventType === 'UPDATE') {
      return <Badge bg="warning" className="text-black">{eventType}</Badge>;
    } else if (eventType === 'DELETE') {
      return <Badge bg="danger">{eventType}</Badge>;
    } else {
      return <Badge bg="secondary">{eventType}</Badge>;
    }
  };

  const formatValue = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    // eslint-disable-next-line no-restricted-globals
    if (value instanceof Date) return format(value);
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getChangesData = (changedFields: any): [React.ReactNode, React.ReactNode][] => {
    if (!changedFields) return [];

    return Object.entries(changedFields).map(([key, value]): [React.ReactNode, React.ReactNode] => [
      <code className="text-primary">{key}</code>,
      <span className="font-monospace small text-break">{formatValue(value)}</span>
    ]);
  };

  return (
    <Offcanvas show={show} onHide={onHide} placement="end" style={{ width: '600px' }}>
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Audit History</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        <InputGroup className="mb-3">
          <Form.Select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            style={{ maxWidth: '250px' }}
          >
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Form.Select>
          <Form.Control
            type="number"
            placeholder="ID"
            value={entityId}
            style={{ maxWidth: 80 }}
            onChange={(e) => setEntityId(e.target.value)}
            onKeyPress={handleKeyPress}
            min="1"
          />
          <Button variant="primary" onClick={handleSearch}>
            <i className="bi bi-search"></i>
          </Button>
        </InputGroup>

        {!queryParams ? (
          <div className="text-center text-muted py-4">
            <i className="bi bi-search fs-1 d-block mb-2"></i>
            Enter an entity type and ID to view audit history
          </div>
        ) : isLoading ? (
          <Loading />
        ) : !entityLogs || entityLogs.length === 0 ? (
          <div className="text-center text-muted py-4">
            <i className="bi bi-inbox fs-1 d-block mb-2"></i>
            No audit logs found for <code className="text-primary">{queryParams.entityType}</code> #{queryParams.entityId}
          </div>
        ) : (
          <>
            <div className="d-flex flex-column gap-3">
              {entityLogs.map((log: any) => (
                <div key={log.id} className="border rounded overflow-hidden">
                  {/* Event Header */}
                  <div className="bg-light px-3 py-2 border-bottom">
                    <div className="mb-1">{getEventTypeBadge(log.eventType)}</div>
                    <small className="text-muted">{log.actorUser.name} at {format(log.eventTimestamp)}</small>
                  </div>

                  {/* Changes Section */}
                  {log.changedFields?.changes && (
                    <div className="px-3 py-2 border-top">
                      <DataField
                        data={Object.entries(log.changedFields.changes).map(([key, value]) => [
                          key,
                          <code>{JSON.stringify(value).replace(/^"|"$/g, '')}</code>
                        ])}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Offcanvas.Body>
    </Offcanvas>
  );
}
