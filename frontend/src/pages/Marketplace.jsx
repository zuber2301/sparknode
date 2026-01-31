import { useState } from 'react'
import { HiOutlineShoppingCart, HiOutlineCog, HiOutlineCheck, HiOutlineX, HiOutlinePlus } from 'react-icons/hi'

export default function Marketplace() {
  const [vendors, setVendors] = useState([
    { id: 1, name: 'Amazon', enabled: true, markup: 15 },
    { id: 2, name: 'Swiggy', enabled: true, markup: 12 },
    { id: 3, name: 'Uber', enabled: false, markup: 10 },
  ])
  const [merchandise, setMerchandise] = useState([
    { id: 1, name: 'SparkNode Coffee Mug', stock: 450, price: 8.5 },
    { id: 2, name: 'SparkNode T-Shirt', stock: 320, price: 12 },
    { id: 3, name: 'SparkNode Hoodie', stock: 180, price: 25 },
  ])
  const [editingVendor, setEditingVendor] = useState(null)

  const toggleVendor = (vendorId) => {
    setVendors(vendors.map(v => v.id === vendorId ? { ...v, enabled: !v.enabled } : v))
  }

  const updateMarkup = (vendorId, markup) => {
    setVendors(vendors.map(v => v.id === vendorId ? { ...v, markup: parseFloat(markup) } : v))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <HiOutlineShoppingCart className="w-8 h-8 text-sparknode-purple" />
          Marketplace Management
        </h1>
        <p className="text-gray-600 mt-1">Manage vendor partnerships, redemption options, and physical merchandise inventory</p>
      </div>

      {/* Vendor Management Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Vendor Management</h2>
          <p className="text-sm text-gray-600 mt-1">Enable/disable vendors and configure profit margins</p>
        </div>

        <div className="divide-y divide-gray-200">
          {vendors.map((vendor) => (
            <div key={vendor.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                  <HiOutlineCog className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{vendor.name}</h3>
                  <p className="text-sm text-gray-500">Redemption provider</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Markup %</label>
                  <input
                    type="number"
                    value={vendor.markup}
                    onChange={(e) => updateMarkup(vendor.id, e.target.value)}
                    className="input w-20 text-sm"
                    disabled={!vendor.enabled}
                  />
                </div>
                <button
                  onClick={() => toggleVendor(vendor.id)}
                  className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                    vendor.enabled
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {vendor.enabled ? (
                    <>
                      <HiOutlineCheck className="w-4 h-4" />
                      Enabled
                    </>
                  ) : (
                    <>
                      <HiOutlineX className="w-4 h-4" />
                      Disabled
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button className="flex items-center gap-2 px-4 py-2 bg-sparknode-purple text-white rounded-lg font-medium hover:bg-opacity-90 transition-colors">
            <HiOutlinePlus className="w-4 h-4" />
            Add Vendor
          </button>
        </div>
      </div>

      {/* Merchandise Inventory Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">SparkNode Merchandise</h2>
          <p className="text-sm text-gray-600 mt-1">Manage physical merchandise fulfillment and inventory</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {merchandise.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.stock} units</td>
                  <td className="px-6 py-4 text-sm text-gray-600">${item.price.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm">
                    <button className="text-sparknode-purple hover:text-sparknode-purple font-medium">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button className="flex items-center gap-2 px-4 py-2 bg-sparknode-purple text-white rounded-lg font-medium hover:bg-opacity-90 transition-colors">
            <HiOutlinePlus className="w-4 h-4" />
            Add Merchandise
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Vendors</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{vendors.filter(v => v.enabled).length}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <HiOutlineShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg. Markup</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{(vendors.filter(v => v.enabled).reduce((sum, v) => sum + v.markup, 0) / vendors.filter(v => v.enabled).length).toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <HiOutlineCog className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Merch Stock</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{merchandise.reduce((sum, m) => sum + m.stock, 0)}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <HiOutlineShoppingCart className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
