import React, { useState } from 'react';
import { useAction, useQuery } from 'wasp/client/operations';
import { Card, Alert, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { PageHeader, AutoForm, Loading } from '../components';
import { updateUserProfile, getUser } from 'wasp/client/operations';
import { isAdmin } from '../utils/auth/client';
import { UserRole, getUserRoleLabel } from '../auth/types';
import { ROUTES } from '../routes';

const PAGE_WIDTH = 400;

export function ProfilePage() {
    const { data: user } = useQuery(getUser);
    const updateUserProfileFn = useAction(updateUserProfile);

    if (!user) return <Loading />;

    const email = user.email || '';

    const profileFields = [
        {
            key: 'name',
            label: 'Name',
            type: 'text' as const,
            description: 'Your display name'
        },
        {
            key: 'email',
            label: 'Email',
            type: 'text' as const,
            description: 'Your email address for account access',
            customRender: () => (
                <Form.Control
                    type="text"
                    value={email}
                    readOnly
                    className="bg-light"
                />
            )
        },
        {
            key: 'role',
            label: 'Role',
            type: 'select' as const,
            description: isAdmin(user) ? undefined : 'Only administrators can change user roles',
            disabled: !isAdmin(user),
            options: Object.values(UserRole).map(role => ({
                value: role,
                label: getUserRoleLabel(role)
            }))
        },
        {
            key: 'password',
            label: 'Password',
            type: 'custom' as const,
            customRender: () => (
                <div className="small text-muted">
                    <span>You can reset your password </span>
                    <Link
                        to={ROUTES.requestPasswordReset.path}
                        className="text-primary"
                    >here</Link>.
                </div>
            )
        }
    ];

    const [formData, setFormData] = useState({
        name: user.name,
        email: email,
        role: user.role
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleFieldChange = (key: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setSuccessMessage('');
        setErrorMessage('');

        try {
            await updateUserProfileFn(formData);
            setSuccessMessage('Profile updated successfully!');
        } catch (error: any) {
            setErrorMessage(error.message || 'Failed to update profile. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <PageHeader title="Profile" />
            <Card>
                <Card.Body style={{ maxWidth: PAGE_WIDTH }}>
                    {successMessage && (
                        <Alert variant="success" dismissible onClose={() => setSuccessMessage('')}>
                            {successMessage}
                        </Alert>
                    )}

                    {errorMessage && (
                        <Alert variant="danger" dismissible onClose={() => setErrorMessage('')}>
                            {errorMessage}
                        </Alert>
                    )}

                    <AutoForm
                        fields={profileFields.map(field => {
                            const autoFormField: any = {
                                key: field.key,
                                label: field.label,
                                type: field.type
                            };

                            if (field.description) {
                                autoFormField.description = field.description;
                            }

                            if (field.options !== undefined) {
                                autoFormField.options = field.options;
                            }

                            if (field.disabled !== undefined) {
                                autoFormField.disabled = field.disabled;
                            }

                            if (field.customRender !== undefined) {
                                autoFormField.customRender = field.customRender;
                            }

                            return autoFormField;
                        })}
                        values={formData}
                        onChange={handleFieldChange}
                        onSubmit={handleSubmit}
                        isSubmitting={isSubmitting}
                    />

                </Card.Body>
            </Card>
        </>
    );
} 