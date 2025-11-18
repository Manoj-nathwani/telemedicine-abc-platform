import React, { useState } from 'react';
import { useQuery, getUsers, getAuditLogsByUser, getRecentAuditLogs } from 'wasp/client/operations';
import { Row, Col, Card, Table, Badge, Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import { PageHeader, Loading, UserDisplay } from '../../components';
import { format } from '../../utils/dateTime';
import { EntityAuditHistoryOffcanvas } from './EntityAuditHistoryOffcanvas';

export function AuditLogsPage() {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: number } | null>(null);

  const { data: users, isLoading: usersLoading } = useQuery(getUsers);
  const { data: userAuditLogs, isLoading: userLogsLoading, refetch: refetchUserLogs } = useQuery(
    getAuditLogsByUser,
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const { data: recentAuditLogs, isLoading: recentLogsLoading, refetch: refetchRecentLogs } = useQuery(
    getRecentAuditLogs,
    undefined,
    { enabled: !selectedUserId }
  );

  // Prepare user options for react-select
  const userOptions = users?.map((user: any) => ({
    value: user.id,
    label: `${user.name} ${user.email ? `(${user.email})` : ''}`,
  })) || [];

  const displayLogs = selectedUserId ? userAuditLogs : recentAuditLogs;
  const isLoading = selectedUserId ? userLogsLoading : recentLogsLoading;

  const getEventTypeBadge = (eventType: string) => {
    const variants: Record<string, string> = {
      CREATE: 'success',
      UPDATE: 'warning',
    };
    return <Badge bg={variants[eventType] || 'secondary'}>{eventType}</Badge>;
  };

  const formatChangedFields = (changedFields: any) => {
    if (!changedFields) return '-';

    try {
      const changes = JSON.parse(JSON.stringify(changedFields));
      if (changes.changes) {
        return Object.keys(changes.changes).join(', ');
      }
      return Object.keys(changes).join(', ');
    } catch {
      return 'Multiple fields';
    }
  };

  const handleRefresh = () => {
    if (selectedUserId) {
      refetchUserLogs();
    } else {
      refetchRecentLogs();
    }
  };

  return (
    <Row>
      <Col>
        <PageHeader title="Audit Logs">
          <Button
            variant="primary"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <i className="bi bi-arrow-clockwise me-1"></i>
            Refresh
          </Button>
        </PageHeader>

        <Card className="shadow-sm mb-3">
          <Card.Body>
            <Form.Group>
              <Form.Label>Filter by User</Form.Label>
              <Select
                options={userOptions}
                isLoading={usersLoading}
                isClearable
                placeholder="Select a user to view their audit logs..."
                onChange={(option) => setSelectedUserId(option?.value || null)}
                styles={{
                  control: (base) => ({
                    ...base,
                    minHeight: '38px',
                  }),
                }}
              />
              <Form.Text className="text-muted">
                {selectedUserId
                  ? 'Showing logs for selected user'
                  : 'Showing recent logs from all users (last 50 events)'}
              </Form.Text>
            </Form.Group>
          </Card.Body>
        </Card>

        <Card className="shadow-sm">
          <Card.Body>
            {isLoading ? (
              <Loading />
            ) : !displayLogs || displayLogs.length === 0 ? (
              <div className="text-center text-muted py-4">
                <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                No audit logs found
              </div>
            ) : (
              <Table responsive hover className="mb-0 align-middle small">
                <thead className="table-light">
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {displayLogs.map((log: any) => (
                    <tr key={log.id}>
                      <td className="text-nowrap">
                        {format(log.eventTimestamp)}
                      </td>
                      <td>
                        <div className="text-truncate" style={{ maxWidth: '150px' }}>
                          <UserDisplay user={log.actorUser} />
                        </div>
                      </td>
                      <td>{getEventTypeBadge(log.eventType)}</td>
                      <td>
                        <Button
                          variant="link"
                          className="p-0 text-black"
                          onClick={() => setSelectedEntity({ type: log.entityType, id: log.entityId })}
                        >
                          {`${log.entityType} #${log.entityId}`}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            {displayLogs && displayLogs.length > 0 && (
              <div className="text-muted small mt-2">
                Showing {displayLogs.length} log{displayLogs.length !== 1 ? 's' : ''}
                {selectedUserId && ' for selected user'}
              </div>
            )}
          </Card.Body>
        </Card>
      </Col>

      <EntityAuditHistoryOffcanvas
        show={!!selectedEntity}
        onHide={() => setSelectedEntity(null)}
        {...(selectedEntity && {
          initialEntityType: selectedEntity.type,
          initialEntityId: selectedEntity.id
        })}
      />
    </Row>
  );
}
