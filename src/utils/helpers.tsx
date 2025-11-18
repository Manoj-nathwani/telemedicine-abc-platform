/**
 * Formats a phone number string into a human readable format (XXX-XXX-XXXX)
 * @param phoneNumber A string of 10 digits
 * @returns React.ReactNode containing the formatted phone number
 */
export function formatPhoneNumber(phoneNumber: string): React.ReactNode {

    // Format as XXX-XXX-XXXX and wrap in monospace font
    return (
        <span className="font-monospace">
            {phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}
        </span>
    );
}
