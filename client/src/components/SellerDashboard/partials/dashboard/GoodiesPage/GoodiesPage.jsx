import { useState, useEffect, useCallback } from 'react';
import { useThemeProvider } from '../../../utils/ThemeContext';
import { 
  Package, 
  ShoppingBag, 
  List, 
  Grid, 
  Search,
  Plus,
  Trash2,
  IndianRupee,
  Boxes,
  Layers,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-toastify';
import AddProductForm from './SellGoodiesPage';
import axiosWithAuth from '../../../../../redux/slices/axiosWithAuth';
import { formatCurrency } from '../../../../../lib/utils';

// Stat Card Component
const StatCard = ({ title, value, icon, subtitle }) => {
  const { currentTheme } = useThemeProvider();
  
  return (
    <div className={`p-5 rounded-xl border shadow-sm transition-all ${
      currentTheme === 'dark' 
        ? 'bg-[#1e1713]/80 border-[#3d2c1d] text-[#e8dfd8]' 
        : 'bg-white border-[#e5dcd3] text-[#2c1810]'
    }`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">{title}</p>
          <h3 className="text-2xl font-bold mt-1 text-[#2c1810] dark:text-[#f8d7bd]">{value}</h3>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="h-11 w-11 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-500/20">
          {icon}
        </div>
      </div>
    </div>
  );
};

export default function SellerDashboard() {
  const { currentTheme } = useThemeProvider();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('price');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axiosWithAuth.get('/goodies');
      const goodies = Array.isArray(response.data) ? response.data : [];
      setProducts(goodies);
    } catch (err) {
      console.error("Failed to load goodies catalog:", err);
      setError("Unable to load merchandise goodies catalog.");
      toast.error("Failed to load goodies catalog");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from goodies catalog?`)) {
      return;
    }
    try {
      setDeletingId(id);
      await axiosWithAuth.delete(`/goodies/${id}`);
      setProducts(prev => prev.filter(p => p._id !== id));
      toast.success("Product removed from catalog");
    } catch (err) {
      console.error("Failed to delete goodie:", err);
      toast.error("Failed to delete product");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredProducts = products
    .filter(product => {
      if (filter === 'all') return true;
      return (product.category || '').toLowerCase() === filter.toLowerCase();
    })
    .filter(product => {
      const term = searchTerm.toLowerCase();
      const name = (product.name || '').toLowerCase();
      const desc = (product.description || '').toLowerCase();
      return name.includes(term) || desc.includes(term);
    })
    .sort((a, b) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

  // Calculate real inventory statistics
  const totalProducts = products.length;
  const totalUnits = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
  const totalValue = products.reduce((acc, p) => acc + ((Number(p.price) || 0) * (Number(p.stock) || 0)), 0);
  const uniqueCategories = new Set(products.map(p => (p.category || '').toLowerCase()).filter(Boolean));

  return (
    <div className="min-h-screen text-gray-800 dark:text-gray-100 pb-16">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#2c1810] dark:text-[#f8d7bd]">Goodies Catalog</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Manage promotional merchandise and loyalty rewards</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
              title="Refresh catalog"
              aria-label="Refresh catalog"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-lg flex items-center gap-2 font-medium shadow-sm transition-all"
            >
              <Plus size={18} />
              Add Product
            </button>
          </div>
        </div>

        {/* Real Live Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard 
            title="Catalog Items" 
            value={totalProducts} 
            subtitle={`${filteredProducts.length} items currently displayed`}
            icon={<Package size={22} />} 
          />
          <StatCard 
            title="Inventory Units" 
            value={totalUnits.toLocaleString()} 
            subtitle="Total units in stock"
            icon={<Boxes size={22} />} 
          />
          <StatCard 
            title="Inventory Value" 
            value={formatCurrency(totalValue)}
            subtitle="At current catalog prices"
            icon={<IndianRupee size={22} />}
          />
          <StatCard 
            title="Categories" 
            value={uniqueCategories.size} 
            subtitle="Distinct product lines"
            icon={<Layers size={22} />} 
          />
        </div>

        {/* Products Container */}
        <div className={`rounded-xl border shadow-sm ${
          currentTheme === 'dark' 
            ? 'bg-[#1e1713]/80 border-[#3d2c1d]' 
            : 'bg-white border-[#e5dcd3]'
        }`}>
          {/* Controls Bar */}
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h3 className="font-bold text-lg text-[#2c1810] dark:text-[#f8d7bd]">Catalog Inventory</h3>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative min-w-[220px]">
                  <input
                    type="text"
                    placeholder="Search goodies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                </div>
                
                <select
                  className="text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  <option value="headsets">Headsets & Audio</option>
                  <option value="shirts">Apparel & Clothing</option>
                  <option value="accessories">Accessories</option>
                  <option value="collectibles">Collectibles</option>
                </select>
                
                <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-1 flex self-start sm:self-auto">
                  <button
                    className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'text-gray-500'}`}
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                  >
                    <Grid size={16} />
                  </button>
                  <button
                    className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'text-gray-500'}`}
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Content Body */}
          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-10 h-10 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading catalog items...</p>
              </div>
            ) : error ? (
              <div className="py-12 text-center text-red-500">
                <p className="font-medium">{error}</p>
                <button 
                  onClick={loadData}
                  className="mt-3 px-4 py-1.5 text-xs bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg hover:underline"
                >
                  Try Again
                </button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-600 dark:text-amber-400">
                  <Package className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-[#2c1810] dark:text-[#f8d7bd] mb-1">
                  {products.length === 0 ? "No Goodies in Catalog" : "No Matching Products Found"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                  {products.length === 0
                    ? "Your promotional merchandise catalog is currently empty. Add your first reward item using the button below."
                    : "Try adjusting your search keywords or clearing active category filters."}
                </p>
                {products.length === 0 ? (
                  <button 
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-lg font-medium transition-all shadow-sm"
                  >
                    <Plus size={18} />
                    Add First Product
                  </button>
                ) : (
                  <button 
                    onClick={() => { setSearchTerm(''); setFilter('all'); }}
                    className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <div 
                    key={product._id} 
                    className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-850/50 p-4 flex flex-col justify-between hover:shadow-md transition-shadow"
                  >
                    <div>
                      <div className="h-44 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden mb-3 relative flex items-center justify-center">
                        {product.images && product.images[0] ? (
                          <img 
                            src={product.images[0]} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`${product.images && product.images[0] ? 'hidden' : ''} text-center p-4 text-gray-400`}>
                          <Package className="w-12 h-12 mx-auto mb-1 opacity-40 text-amber-600" />
                          <span className="text-xs uppercase tracking-wider font-semibold">{product.category || 'Goodie'}</span>
                        </div>
                        <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/90 text-white capitalize shadow-sm">
                          {product.category || 'general'}
                        </span>
                      </div>

                      <h4 className="font-bold text-base text-[#2c1810] dark:text-[#f8d7bd] line-clamp-1">{product.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {product.description || (product.keyFeatures && product.keyFeatures.join(' • ')) || 'Exclusive merchandise item'}
                      </p>
                    </div>

                    <div className="pt-4 mt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-amber-700 dark:text-amber-400">{formatCurrency(product.price)}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          Stock: <strong className={product.stock <= 5 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}>{product.stock}</strong>
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(product._id, product.name)}
                        disabled={deletingId === product._id}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        title="Delete product"
                        aria-label="Delete product"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-xs uppercase text-gray-500 dark:text-gray-400">
                      <th className="py-3 px-4">Product</th>
                      <th 
                        className="py-3 px-4 cursor-pointer hover:text-amber-600"
                        onClick={() => {
                          if (sortBy === 'price') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setSortBy('price'); setSortOrder('desc'); }
                        }}
                      >
                        Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="py-3 px-4 cursor-pointer hover:text-amber-600"
                        onClick={() => {
                          if (sortBy === 'stock') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setSortBy('stock'); setSortOrder('desc'); }
                        }}
                      >
                        Stock {sortBy === 'stock' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredProducts.map((product) => (
                      <tr key={product._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                              {product.images && product.images[0] ? (
                                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-5 h-5 text-amber-600 opacity-60" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-[#2c1810] dark:text-[#f8d7bd]">{product.name}</div>
                              <div className="text-xs text-gray-500 line-clamp-1">{product.description || 'Merchandise item'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-amber-700 dark:text-amber-400">
                          {formatCurrency(product.price)}
                        </td>
                        <td className="py-3 px-4 font-medium">
                          <span className={product.stock <= 5 ? 'text-red-500 font-bold' : ''}>
                            {product.stock} units
                          </span>
                        </td>
                        <td className="py-3 px-4 capitalize text-gray-600 dark:text-gray-300">
                          {product.category || 'general'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDelete(product._id, product.name)}
                            disabled={deletingId === product._id}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors inline-flex items-center"
                            title="Delete product"
                            aria-label="Delete product"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Product Modal */}
      {showAddForm && (
        <AddProductForm 
          onClose={() => setShowAddForm(false)} 
          onProductAdded={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}