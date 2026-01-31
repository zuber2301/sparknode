/**
 * User Filters Component
 * 
 * Search and filter controls for the users list.
 */

import { HiOutlineSearch } from 'react-icons/hi'

export default function UserFilters({
  searchQuery,
  setSearchQuery,
  filterDepartment,
  setFilterDepartment,
  filterStatus,
  setFilterStatus,
  departments
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Search */}
      <div className="relative flex-1">
        <HiOutlineSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-10 w-full"
        />
      </div>

      {/* Department Filter */}
      <select
        value={filterDepartment}
        onChange={(e) => setFilterDepartment(e.target.value)}
        className="input min-w-[150px]"
      >
        <option value="">All Departments</option>
        {departments?.map((dept) => (
          <option key={dept.id} value={dept.id}>
            {dept.name}
          </option>
        ))}
      </select>

      {/* Status Filter */}
      <select
        value={filterStatus}
        onChange={(e) => setFilterStatus(e.target.value)}
        className="input min-w-[150px]"
      >
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="pending_invitation">Pending</option>
        <option value="deactivated">Deactivated</option>
      </select>
    </div>
  )
}
