/**
 * Bulk Upload Modal Component
 * 
 * Modal for handling CSV bulk user uploads with preview and validation.
 */

import { useState } from 'react'
import { HiOutlineX, HiOutlineCloudUpload, HiOutlineRefresh, HiOutlineCheckCircle, HiOutlineExclamationCircle } from 'react-icons/hi'

export default function BulkUploadModal({
  isOpen,
  onClose,
  uploadStep,
  setUploadStep,
  batchInfo,
  stagingData,
  editingStagingId,
  stagingForm,
  setStagingForm,
  sendInvites,
  setSendInvites,
  isUploading,
  isConfirming,
  onFileUpload,
  onDownloadTemplate,
  onConfirmImport,
  onStartEditRow,
  onSaveRow,
  onCancelEdit,
  departments
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {uploadStep === 'upload' && 'Bulk Import Users'}
            {uploadStep === 'preview' && 'Preview & Validate'}
            {uploadStep === 'processing' && 'Import Complete'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <HiOutlineX className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {uploadStep === 'upload' && (
            <UploadStep
              isUploading={isUploading}
              onFileUpload={onFileUpload}
              onDownloadTemplate={onDownloadTemplate}
            />
          )}

          {uploadStep === 'preview' && (
            <PreviewStep
              batchInfo={batchInfo}
              stagingData={stagingData}
              editingStagingId={editingStagingId}
              stagingForm={stagingForm}
              setStagingForm={setStagingForm}
              sendInvites={sendInvites}
              setSendInvites={setSendInvites}
              isConfirming={isConfirming}
              onConfirmImport={onConfirmImport}
              onStartEditRow={onStartEditRow}
              onSaveRow={onSaveRow}
              onCancelEdit={onCancelEdit}
              departments={departments}
            />
          )}

          {uploadStep === 'processing' && (
            <ProcessingComplete onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  )
}

function UploadStep({ isUploading, onFileUpload, onDownloadTemplate }) {
  return (
    <div className="space-y-6">
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
        <HiOutlineCloudUpload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 mb-4">
          Drag and drop a CSV file, or click to select
        </p>
        <label className="btn btn-primary cursor-pointer">
          {isUploading ? (
            <>
              <HiOutlineRefresh className="w-5 h-5 animate-spin mr-2" />
              Uploading...
            </>
          ) : (
            'Select CSV File'
          )}
          <input
            type="file"
            accept=".csv"
            onChange={onFileUpload}
            className="hidden"
            disabled={isUploading}
          />
        </label>
      </div>

      <div className="bg-gray-50 rounded-xl p-4">
        <h3 className="font-medium text-gray-900 mb-2">CSV Format Requirements</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Columns: full_name, email, department, org_role (optional), mobile_phone (optional), manager_email (optional)</li>
          <li>• Org Role values: tenant_user, dept_lead, tenant_manager</li>
          <li>• First row should be headers</li>
        </ul>
        <button
          onClick={onDownloadTemplate}
          className="mt-3 text-indigo-600 text-sm font-medium hover:text-indigo-700"
        >
          Download template →
        </button>
      </div>
    </div>
  )
}

function PreviewStep({
  batchInfo,
  stagingData,
  editingStagingId,
  stagingForm,
  setStagingForm,
  sendInvites,
  setSendInvites,
  isConfirming,
  onConfirmImport,
  onStartEditRow,
  onSaveRow,
  onCancelEdit,
  departments
}) {
  const validRows = stagingData.filter(r => r.is_valid).length
  const invalidRows = stagingData.filter(r => !r.is_valid).length

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{stagingData.length}</div>
          <div className="text-sm text-gray-500">Total Rows</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{validRows}</div>
          <div className="text-sm text-gray-500">Valid</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{invalidRows}</div>
          <div className="text-sm text-gray-500">Invalid</div>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto max-h-80 border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Org Role</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Errors</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {stagingData.map((row) => (
              <StagingRow
                key={row.id}
                row={row}
                isEditing={editingStagingId === row.id}
                stagingForm={stagingForm}
                setStagingForm={setStagingForm}
                onStartEdit={onStartEditRow}
                onSave={onSaveRow}
                onCancel={onCancelEdit}
                departments={departments}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Options and Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={sendInvites}
            onChange={(e) => setSendInvites(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">Send invitation emails to new users</span>
        </label>
        
        <button
          onClick={onConfirmImport}
          disabled={validRows === 0 || isConfirming}
          className="btn btn-primary"
        >
          {isConfirming ? (
            <>
              <HiOutlineRefresh className="w-5 h-5 animate-spin mr-2" />
              Importing...
            </>
          ) : (
            `Import ${validRows} Users`
          )}
        </button>
      </div>
    </div>
  )
}

function StagingRow({
  row,
  isEditing,
  stagingForm,
  setStagingForm,
  onStartEdit,
  onSave,
  onCancel,
  departments
}) {
  if (isEditing) {
    return (
      <tr className="bg-yellow-50">
        <td className="px-4 py-2">
          <HiOutlineExclamationCircle className="w-5 h-5 text-yellow-500" />
        </td>
        <td className="px-4 py-2">
          <input
            type="text"
            value={stagingForm.raw_full_name || ''}
            onChange={(e) => setStagingForm({ ...stagingForm, raw_full_name: e.target.value })}
            className="input text-sm"
          />
        </td>
        <td className="px-4 py-2">
          <input
            type="email"
            value={stagingForm.raw_email || ''}
            onChange={(e) => setStagingForm({ ...stagingForm, raw_email: e.target.value })}
            className="input text-sm"
          />
        </td>
        <td className="px-4 py-2">
          <select
            value={stagingForm.raw_department || ''}
            onChange={(e) => setStagingForm({ ...stagingForm, raw_department: e.target.value })}
            className="input text-sm"
          >
            <option value="">Select...</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </td>
        <td className="px-4 py-2">
          <select
            value={stagingForm.raw_role || ''}
            onChange={(e) => setStagingForm({ ...stagingForm, raw_role: e.target.value })}
            className="input text-sm"
          >
            <option value="">Select...</option>
              <option value="tenant_user">User</option>
            <option value="dept_lead">Department Lead</option>
            <option value="tenant_manager">Tenant Manager</option>
          </select>
        </td>
        <td className="px-4 py-2"></td>
        <td className="px-4 py-2">
          <div className="flex gap-1">
            <button onClick={onSave} className="text-green-600 text-sm">Save</button>
            <button onClick={onCancel} className="text-gray-600 text-sm">Cancel</button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={row.is_valid ? '' : 'bg-red-50'}>
      <td className="px-4 py-2">
        {row.is_valid ? (
          <HiOutlineCheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <HiOutlineExclamationCircle className="w-5 h-5 text-red-500" />
        )}
      </td>
      <td className="px-4 py-2 text-sm">{row.raw_full_name}</td>
      <td className="px-4 py-2 text-sm">{row.raw_email}</td>
      <td className="px-4 py-2 text-sm">{row.raw_department}</td>
      <td className="px-4 py-2 text-sm">{row.raw_role || 'tenant_user'}</td>
      <td className="px-4 py-2 text-sm text-red-600">
        {row.validation_errors?.join(', ')}
      </td>
      <td className="px-4 py-2">
        {!row.is_valid && (
          <button
            onClick={() => onStartEdit(row)}
            className="text-indigo-600 text-sm hover:text-indigo-800"
          >
            Edit
          </button>
        )}
      </td>
    </tr>
  )
}

function ProcessingComplete({ onClose }) {
  return (
    <div className="text-center py-8">
      <HiOutlineCheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Import Complete!</h3>
      <p className="text-gray-600 mb-6">
        Users have been imported successfully. Invitation emails will be sent shortly.
      </p>
      <button onClick={onClose} className="btn btn-primary">
        Done
      </button>
    </div>
  )
}
