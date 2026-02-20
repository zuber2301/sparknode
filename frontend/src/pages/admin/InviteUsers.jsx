import { useState } from 'react';
import { authAPI } from '../../lib/api';
import toast from 'react-hot-toast';

/**
 * Invite Users Admin Component
 * 
 * Allows Tenant Manager and HR Admin to:
 * 1. Generate secure invite links for new users
 * 2. Batch generate for multiple emails
 * 3. Copy links for email templates
 * 4. View expiration times
 * 
 * Each link is:
 * - Email-specific (can't reuse for different email)
 * - One-time use (marked as used after signup)
 * - Time-limited (configurable expiration)
 * - Cryptographically secure
 */
export default function InviteUsers() {
  const [emails, setEmails] = useState('');
  const [expiresHours, setExpiresHours] = useState(24);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState([]);
  const [showTemplate, setShowTemplate] = useState(false);

  const handleGenerateLinks = async () => {
    if (!emails.trim()) {
      toast.error('Please enter at least one email address');
      return;
    }

    setIsLoading(true);

    try {
      const emailList = emails
        .split('\n')
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0 && e.includes('@'));

      if (emailList.length === 0) {
        toast.error('No valid email addresses found');
        setIsLoading(false);
        return;
      }

      const links = [];
      let successCount = 0;
      let failureCount = 0;

      for (const email of emailList) {
        try {
          const response = await authAPI.generateInvitationLink({
            email: email,
            expires_hours: parseInt(expiresHours)
          });

          links.push({
            email: response.email,
            join_url: response.join_url,
            expires_at: response.expires_at,
            token: response.token,
            tenant_name: response.tenant_name,
            status: 'success'
          });

          successCount++;
          toast.success(`Invite generated for ${email}`);
        } catch (error) {
          links.push({
            email: email,
            status: 'error',
            error: error.response?.data?.detail || error.message
          });

          failureCount++;
          toast.error(`Failed for ${email}: ${error.response?.data?.detail || error.message}`);
        }
      }

      setGeneratedLinks(links);

      // Summary toast
      if (failureCount === 0) {
        toast.success(`✅ Generated ${successCount} invite links!`);
      } else {
        toast.success(`Generated ${successCount} links, ${failureCount} failed`);
      }

      // Clear input on success
      if (successCount > 0) {
        setEmails('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = (link) => {
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard!');
  };

  const handleCopyAllLinks = () => {
    const allLinks = generatedLinks
      .filter(l => l.status === 'success')
      .map(l => `${l.email}: ${l.join_url}`)
      .join('\n\n');

    navigator.clipboard.writeText(allLinks);
    toast.success('All links copied!');
  };

  const getExpirationTime = (expiresAt) => {
    const date = new Date(expiresAt);
    return date.toLocaleString('en-IN');
  };

  const formatEmailTemplate = () => {
    return `Subject: Welcome to ${generatedLinks[0]?.tenant_name || 'Our Organization'} on SparkNode!

Hi {{first_name}},

You've been invited to join ${generatedLinks[0]?.tenant_name || 'Our Organization'} on SparkNode!

Click the link below to create your account and get started:

{{join_url}}

This link expires in ${expiresHours} hours.

If you have any questions, please contact your HR administrator.

Welcome to the team! 🎉`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Invite Users to Your Organization
          </h1>
          <p className="text-gray-600">
            Generate secure invite links for new team members. Each link is unique and can only be used once.
          </p>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          {/* Email Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email Addresses (one per line)
            </label>
            <textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="john@example.com&#10;jane@example.com&#10;bob@example.com"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-2">
              {emails.split('\n').filter(e => e.trim().length > 0).length} email(s) entered
            </p>
          </div>

          {/* Expiration Duration */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Link Expiration
            </label>
            <select
              value={expiresHours}
              onChange={(e) => setExpiresHours(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              <option value="1">1 hour</option>
              <option value="6">6 hours</option>
              <option value="24">24 hours (recommended)</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
              <option value="336">14 days</option>
              <option value="720">30 days</option>
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Links will expire after the selected time period
            </p>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateLinks}
            disabled={isLoading || !emails.trim()}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating Invites...
              </span>
            ) : (
              `Generate Invite Links (${emails.split('\n').filter(e => e.trim().length > 0).length})`
            )}
          </button>
        </div>

        {/* Generated Links */}
        {generatedLinks.length > 0 && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-semibold">
                ✅ Generated {generatedLinks.filter(l => l.status === 'success').length} invite links
              </p>
              {generatedLinks.filter(l => l.status === 'error').length > 0 && (
                <p className="text-orange-700 text-sm mt-1">
                  ⚠️ {generatedLinks.filter(l => l.status === 'error').length} failed
                </p>
              )}
            </div>

            {/* Generated Invites */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">Invite Links</h2>
                  {generatedLinks.filter(l => l.status === 'success').length > 0 && (
                    <button
                      onClick={handleCopyAllLinks}
                      className="text-sm bg-gray-200 text-gray-800 px-3 py-1 rounded hover:bg-gray-300 transition-colors"
                    >
                      Copy All Links
                    </button>
                  )}
                </div>
              </div>

              <div className="divide-y divide-gray-200">
                {generatedLinks.map((link, idx) => (
                  <div key={idx} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    {link.status === 'success' ? (
                      <div className="space-y-3">
                        {/* Email and Name */}
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{link.email}</p>
                            <p className="text-sm text-gray-600">
                              {link.tenant_name} • Expires: {getExpirationTime(link.expires_at)}
                            </p>
                          </div>
                          <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                            Success
                          </span>
                        </div>

                        {/* URL Display */}
                        <div className="bg-gray-50 p-3 rounded border border-gray-200 break-all">
                          <p className="text-xs text-gray-600 font-mono">
                            {link.join_url}
                          </p>
                        </div>

                        {/* Copy Button */}
                        <button
                          onClick={() => handleCopyLink(link.join_url)}
                          className="text-sm bg-blue-100 text-blue-800 px-4 py-2 rounded hover:bg-blue-200 transition-colors font-medium"
                        >
                          📋 Copy Link
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{link.email}</p>
                          <p className="text-sm text-red-600">{link.error}</p>
                        </div>
                        <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                          Failed
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Email Template */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Email Template</h3>
                <button
                  onClick={() => setShowTemplate(!showTemplate)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  {showTemplate ? 'Hide' : 'Show'}
                </button>
              </div>

              {showTemplate && (
                <div className="bg-gray-50 p-4 rounded border border-gray-200 font-mono text-sm whitespace-pre-wrap">
                  {formatEmailTemplate()}
                </div>
              )}

              <p className="text-xs text-gray-600 mt-4">
                💡 Tip: Copy the template above and personalize each email. Replace{' '}
                <code className="bg-gray-100 px-1 rounded">{'{first_name}'}</code> and{' '}
                <code className="bg-gray-100 px-1 rounded">{'{join_url}'}</code> with individual values.
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">📧 Next Steps:</h3>
              <ol className="text-sm text-blue-900 space-y-1 list-decimal list-inside">
                <li>Copy each invite link using the "Copy Link" button</li>
                <li>Paste into your email template</li>
                <li>Send to each invitee</li>
                <li>They'll complete signup and automatically join your organization</li>
              </ol>
            </div>
          </div>
        )}

        {/* No Links Generated Yet */}
        {generatedLinks.length === 0 && !isLoading && (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <div className="text-gray-400 text-5xl mb-4">📨</div>
            <p className="text-gray-600 text-lg font-medium">
              Generate invite links to get started
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Enter email addresses above and click "Generate Invite Links"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
