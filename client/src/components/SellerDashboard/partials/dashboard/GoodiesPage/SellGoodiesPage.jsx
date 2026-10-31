import { useState, useEffect, useRef } from 'react';
import { useThemeProvider } from '../../../utils/ThemeContext';
import { 
  X, 
  Plus, 
  ArrowLeft,
  Save,
  ImagePlus,
  Trash2,
  AlertCircle
} from 'lucide-react';
import axiosWithAuth from '../../../../../redux/slices/axiosWithAuth';

// Real API function to submit product data
const submitProductData = async (productData) => {
  const payload = {
    name: productData.name,
    category: productData.category,
    price: productData.price,
    stock: productData.stock,
    description: productData.description,
    keyFeatures: productData.featurePoints,
    images: productData.image ? [productData.image] : []
  };
  const response = await axiosWithAuth.post('/goodies', payload);
  return { 
    success: true, 
    message: 'Product added successfully',
    data: response.data 
  };
};

// Categories for dropdown
const productCategories = [
  { id: 'headsets', name: 'Headsets & Audio' },
  { id: 'shirts', name: 'Apparel & Clothing' },
  { id: 'accessories', name: 'Accessories' },
  { id: 'collectibles', name: 'Collectibles' }
];

export default function AddProductForm({ onClose, onProductAdded }) {
  const { currentTheme } = useThemeProvider();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    stock: '',
    featurePoints: ['', ''],
    image: null
  });
  
  // Form validation state
  const [validationErrors, setValidationErrors] = useState({});
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear validation error when field is edited
    if (validationErrors[name]) {
      setValidationErrors({
        ...validationErrors,
        [name]: null
      });
    }
  };
  
  const handleFeaturePointChange = (index, value) => {
    const updatedPoints = [...formData.featurePoints];
    updatedPoints[index] = value;
    
    setFormData({
      ...formData,
      featurePoints: updatedPoints
    });
  };
  
  const addFeaturePoint = () => {
    if (formData.featurePoints.length < 6) {
      setFormData({
        ...formData,
        featurePoints: [...formData.featurePoints, '']
      });
    }
  };
  
  const removeFeaturePoint = (index) => {
    const updatedPoints = formData.featurePoints.filter((_, i) => i !== index);
    
    setFormData({
      ...formData,
      featurePoints: updatedPoints
    });
  };
  
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        setError('Image file must be under 3MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          image: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageSelection = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const removeImage = () => {
    setFormData({
      ...formData,
      image: null
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) errors.name = 'Product name is required';
    if (!formData.description.trim()) errors.description = 'Description is required';
    if (!formData.category) errors.category = 'Please select a category';
    
    if (!formData.price) {
      errors.price = 'Price is required';
    } else if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
      errors.price = 'Price must be a positive number';
    }
    
    if (!formData.stock) {
      errors.stock = 'Stock quantity is required';
    } else if (isNaN(parseInt(formData.stock)) || parseInt(formData.stock) < 0) {
      errors.stock = 'Stock must be a non-negative integer';
    }
    
    // Clean empty feature points before validation
    const nonEmptyPoints = formData.featurePoints.filter(point => point.trim() !== '');
    if (nonEmptyPoints.length === 0) {
      errors.featurePoints = 'Add at least one feature point';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      // Scroll to the first error
      const firstErrorField = Object.keys(validationErrors)[0];
      document.getElementsByName(firstErrorField)[0]?.focus();
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Clean empty feature points before submission
      const cleanedData = {
        ...formData,
        featurePoints: formData.featurePoints.filter(point => point.trim() !== ''),
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock)
      };
      
      const response = await submitProductData(cleanedData);
      
      if (response.success) {
        setSuccess(true);
        if (typeof onProductAdded === 'function') {
          onProductAdded();
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(response.message || 'Failed to add product');
      }
    } catch (err) {
      setError('An error occurred while adding the product');
      console.error('Error adding product:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className={`relative w-full max-w-3xl rounded-lg shadow-xl ${currentTheme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-inherit">
          <div className="flex items-center">
            <button
              onClick={onClose}
              className="mr-4 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-xl font-bold">Add New Product</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Success message */}
        {success && (
          <div className="m-6 p-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg">
            Product added successfully! Redirecting...
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="m-6 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg flex items-start">
            <AlertCircle size={20} className="mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Error adding product</p>
              <p>{error}</p>
            </div>
          </div>
        )}
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column - Product details */}
            <div className="space-y-6">
              {/* Product Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Premium Gaming Headset"
                  className={`w-full px-4 py-2 rounded-lg border ${validationErrors.name ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500`}
                />
                {validationErrors.name && (
                  <p className="mt-1 text-sm text-red-500">{validationErrors.name}</p>
                )}
              </div>
              
              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 rounded-lg border ${validationErrors.category ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="">Select a category</option>
                  {productCategories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {validationErrors.category && (
                  <p className="mt-1 text-sm text-red-500">{validationErrors.category}</p>
                )}
              </div>
              
              {/* Price and Stock (side by side) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium mb-1">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="99.99"
                    className={`w-full px-4 py-2 rounded-lg border ${validationErrors.price ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500`}
                  />
                  {validationErrors.price && (
                    <p className="mt-1 text-sm text-red-500">{validationErrors.price}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="stock" className="block text-sm font-medium mb-1">
                    Stock <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="stock"
                    name="stock"
                    value={formData.stock}
                    onChange={handleInputChange}
                    placeholder="25"
                    className={`w-full px-4 py-2 rounded-lg border ${validationErrors.stock ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500`}
                  />
                  {validationErrors.stock && (
                    <p className="mt-1 text-sm text-red-500">{validationErrors.stock}</p>
                  )}
                </div>
              </div>
              
              {/* Product Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-1">
                  Product Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Describe your product in detail..."
                  className={`w-full px-4 py-2 rounded-lg border ${validationErrors.description ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500`}
                />
                {validationErrors.description && (
                  <p className="mt-1 text-sm text-red-500">{validationErrors.description}</p>
                )}
              </div>
            </div>
            
            {/* Right column - Features and Image */}
            <div className="space-y-6">
              {/* Feature Points */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium">
                    Key Features <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formData.featurePoints.length}/6 points
                  </span>
                </div>
                
                {validationErrors.featurePoints && (
                  <p className="mb-2 text-sm text-red-500">{validationErrors.featurePoints}</p>
                )}
                
                <div className="space-y-3">
                  {formData.featurePoints.map((point, index) => (
                    <div key={index} className="flex items-center">
                      <input
                        type="text"
                        value={point}
                        onChange={(e) => handleFeaturePointChange(index, e.target.value)}
                        placeholder={`Feature point ${index + 1}`}
                        className="flex-grow px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                      />
                      {formData.featurePoints.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFeaturePoint(index)}
                          className="ml-2 p-2 text-gray-500 hover:text-red-500 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                          aria-label="Remove feature point"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                {formData.featurePoints.length < 6 && (
                  <button
                    type="button"
                    onClick={addFeaturePoint}
                    className="mt-3 flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    <Plus size={16} className="mr-1" />
                    Add Feature Point
                  </button>
                )}
              </div>
              
              {/* Product Image */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Product Image
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  accept="image/*"
                  className="hidden"
                />
                {formData.image ? (
                  <div className="relative rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                    <img 
                      src={formData.image} 
                      alt="Product preview"
                      className="w-full h-48 object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                      aria-label="Remove image"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleImageSelection}
                    className="w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ImagePlus size={24} className="text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">Click to upload product image</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Form actions */}
          <div className="mt-8 flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className={`px-6 py-2 bg-blue-600 text-white rounded-lg flex items-center ${loading || success ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'}`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} className="mr-2" />
                  Save Product
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}