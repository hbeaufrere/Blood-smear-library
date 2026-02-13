import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import UCDavisNavbar from '../Component/UCDavisNavbar';
import './AdminUploadPage.css';
import { convertUploadDataTiffsToPng } from '../util/tiffConverter';
import UTIF from 'utif'; 
import { convertTiffToPng } from '../util/tiffConverter';
import WholeSlideViewer from '../Component/WholeSlideViewer';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AdminUploadPage = () => {
  const navigate = useNavigate();
  const [uploadType, setUploadType] = useState('fullSlide');
  const [recentUploadsCount, setRecentUploadsCount] = useState(0);

  // Taxonomic classification data
  const phylumClassMapping = {
    'Porifera': ['Calcarea', 'Demospongiae', 'Hexactinellida'],
    'Cnidaria': ['Anthozoa', 'Scyphozoa', 'Cubozoa', 'Hydrozoa', 'Staurozoa'],
    'Ctenophora': ['Tentaculata', 'Nuda'],
    'Platyhelminthes': ['Turbellaria', 'Trematoda', 'Cestoda', 'Monogenea'],
    'Nematoda': ['Chromadorea', 'Enoplea'],
    'Rotifera': ['Monogononta', 'Bdelloidea'],
    'Annelida': ['Polychaeta', 'Oligochaeta', 'Hirudinea'],
    'Mollusca': ['Gastropoda', 'Bivalvia', 'Cephalopoda', 'Polyplacophora', 'Monoplacophora', 'Scaphopoda', 'Solenogastres', 'Caudofoveata'],
    'Arthropoda': ['Insecta', 'Arachnida', 'Merostomata', 'Pycnogonida', 'Chilopoda', 'Diplopoda', 'Pauropoda', 'Symphyla', 'Malacostraca', 'Branchiopoda', 'Maxillopoda', 'Ostracoda', 'Remipedia', 'Cephalocarida', 'Hexanauplia'],
    'Echinodermata': ['Asteroidea', 'Ophiuroidea', 'Echinoidea', 'Holothuroidea', 'Crinoidea'],
    'Chordata': ['Mammalia', 'Aves', 'Reptilia', 'Amphibia', 'Osteichthyes', 'Chondrichthyes', 'Agnatha', 'Ascidiacea', 'Thaliacea', 'Larvacea', 'Cephalochordata']
  };
  const [formData, setFormData] = useState({
    // Common metadata
    common_name: '',
    scientific_name: '',
    phylum: '',
    class: '',
    order: '',
    family: '',
    health_status: '',
    stain: '',
    contributor: '',
    collected_at: '',
    source: '',
    user_email: 'admin@ucdavis.edu',
    user_name: 'Dr. Sarah Johnson',
    user_role: 'admin',
    
    // New optional fields
    sex: '',
    age_years: '',
    age_months: '',
    age_days: '',
    magnification: '',
    scanner_type: '',
    disease: '',
    stain_other: '',
    phylum_other: '',
    
    // Full slide specific
    fullSlideImage: null,
    
    // Cellavision specific
    cellTypes: [
      {
        type: 'Neutrophil',
        images: [],
        count: 0
      },
      {
        type: 'Lymphocyte',
        images: [],
        count: 0
      },
      {
        type: 'Monocyte',
        images: [],
        count: 0
      },
      {
        type: 'Eosinophil',
        images: [],
        count: 0
      },
      {
        type: 'Basophil',
        images: [],
        count: 0
      },
      {
        type: 'Platelet',
        images: [],
        count: 0
      },
      {
        type: 'Red Blood Cell',
        images: [],
        count: 0
      }
    ]
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentUploads, setRecentUploads] = useState(() => {
    // Load recent uploads from localStorage on component mount
    const saved = localStorage.getItem('recentUploads');
    return saved ? JSON.parse(saved) : [];
  });

  // Update count whenever recentUploads changes
  useEffect(() => {
    setRecentUploadsCount(recentUploads.length);
  }, [recentUploads]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // If phylum changes, reset class field
    if (name === 'phylum') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        class: '' // Reset class when phylum changes
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFullSlideImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        fullSlideImage: file
      }));
    }
  };

  const handleCellTypeImageChange = (index, e) => {
    const newFiles = Array.from(e.target.files);
    const updatedCellTypes = [...formData.cellTypes];
    
    // Append new files to existing ones instead of replacing
    updatedCellTypes[index].images = [...updatedCellTypes[index].images, ...newFiles];
    updatedCellTypes[index].count = updatedCellTypes[index].images.length;
    
    setFormData(prev => ({
      ...prev,
      cellTypes: updatedCellTypes
    }));
    
    // Clear the input so the same files can be selected again if needed
    e.target.value = '';
  };

  const addCustomCellType = () => {
    const newType = prompt('Enter custom cell type name:');
    if (newType && newType.trim()) {
      setFormData(prev => ({
        ...prev,
        cellTypes: [
          ...prev.cellTypes,
          {
            type: newType.trim(),
            images: [],
            count: 0
          }
        ]
      }));
    }
  };

  const removeCellType = (index) => {
    if (formData.cellTypes.length > 1) {
      const updatedCellTypes = formData.cellTypes.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        cellTypes: updatedCellTypes
      }));
    }
  };

  const removeImage = (cellTypeIndex, imageIndex) => {
    const updatedCellTypes = [...formData.cellTypes];
    updatedCellTypes[cellTypeIndex].images = updatedCellTypes[cellTypeIndex].images.filter((_, i) => i !== imageIndex);
    updatedCellTypes[cellTypeIndex].count = updatedCellTypes[cellTypeIndex].images.length;
    
    setFormData(prev => ({
      ...prev,
      cellTypes: updatedCellTypes
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    // Validate common metadata
    if (!formData.common_name.trim()) {
      newErrors.common_name = 'Common name is required';
    }
    if (!formData.scientific_name.trim()) {
      newErrors.scientific_name = 'Scientific name is required';
    }
    if (!formData.contributor.trim()) {
      newErrors.contributor = 'Contributor is required';
    }
    if (!formData.collected_at) {
      newErrors.collected_at = 'Collection date is required';
    }
    if (!formData.source.trim()) {
      newErrors.source = 'Source is required';
    }

    // Validate upload type specific requirements
    if (uploadType === 'fullSlide') {
      if (!formData.fullSlideImage) {
        newErrors.fullSlideImage = 'Full slide image is required';
      }
    } else if (uploadType === 'cellavision') {
      const hasImages = formData.cellTypes.some(cellType => cellType.images.length > 0);
      if (!hasImages) {
        newErrors.cellavision = 'At least one cell type must have images';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsSubmitting(true);
      setIsProcessing(true);
      setJobStatus(null);
      
      try {
        // Create FormData for file upload
        const formDataToSend = new FormData();
        
        // Create metadata object for backend
        const metadata = {
          common_name: formData.common_name,
          scientific_name: formData.scientific_name,
          taxonomy: {
            phylum: formData.phylum,
            class: formData.class,
            order: formData.order,
            family: formData.family
          },
          health_status: formData.health_status,
          stain: formData.stain,
          contributor: formData.contributor,
          collected_at: formData.collected_at,
          source: formData.source,
          // Required fields for backend
          user_email: formData.user_email, // Default admin email
          user_name: formData.user_name, // Default admin name
          user_id: "admin-001", // Default admin ID
          user_role: formData.user_role,
          approved: true,
          // Additional optional fields
          sex: formData.sex,
          age: {
            years: formData.age_years,
            months: formData.age_months,
            days: formData.age_days
          },
          magnification: formData.magnification,
          scanner_type: formData.scanner_type,
          disease: formData.disease,
          stain_other: formData.stain_other,
          phylum_other: formData.phylum_other
        };
  
        // Add metadata as JSON string
        formDataToSend.append('metadata', JSON.stringify(metadata));
  
        // Add upload type
        formDataToSend.append('uploadType', uploadType);
  
        if (formData.fullSlideImage) {
          formDataToSend.append("whole_slide", formData.fullSlideImage);
        }
        
        // Always attach cellavision images if present
        formData.cellTypes.forEach((cellType, index) => {
          if (cellType.images.length > 0) {
            cellType.images.forEach((image) => {
              formDataToSend.append(`cellavision[${index}]`, image);
            });
            formDataToSend.append(`cell_type[${index}]`, cellType.type);
          }
        });
        // Call the actual upload API
        const response = await fetch(`${API_URL}/api/upload/admin`, {
          method: 'POST',
          body: formDataToSend
        });
  
        const result = await response.json();
  
        if (response.ok) {
          // Store the job_id from the API response
          const { job_id } = result;
          setCurrentJobId(job_id);
          setJobStatus({
            status: result.status,
            message: result.message,
            job_id: job_id
          });
          
          // Start polling for upload status
          let pollCount = 0;
          const maxPolls = 120; // 120 polls * 5 seconds = 10 minutes max
          
          const pollInterval = setInterval(async () => {
            pollCount++;
            
            try {
              const uploadResponse = await fetch(`${API_URL}/api/uploads/${job_id}`);
              const uploadResult = await uploadResponse.json();
              
              console.log(`Polling attempt ${pollCount}: Status = ${uploadResult.data?.status}`, uploadResult);
              
              if (uploadResponse.ok && uploadResult.success) {
                const uploadData = uploadResult.data;
                
                // Update job status in UI
                setJobStatus({
                  status: uploadData.status,
                  message: getStatusMessage(uploadData.status),
                  job_id: job_id
                });
                
                // Check if S3 upload is complete and DZI is ready
                const isS3UploadComplete = 
                  uploadData.status === 'ready_for_viewer' && 
                  uploadData.dzi_outputs?.whole_slide?.length > 0;
                
                // Check if cellavision-only upload is complete (no whole slide)
                const isCellavisionOnlyComplete = 
                  uploadData.status === 'ready_for_viewer' && 
                  !uploadData.whole_slide_image;
                
                // Also check if partially uploaded or failed
                const isProcessingComplete = 
                  uploadData.status === 'ready_for_viewer' ||
                  uploadData.status === 'partially_uploaded' ||
                  uploadData.status === 'failed';
                
                if (isS3UploadComplete || isCellavisionOnlyComplete) {
                  console.log("✅ Processing complete! DZI data:", uploadData.dzi_outputs);
                  clearInterval(pollInterval);
                  
                  // Save the upload data with all DZI information
                  const hasWholeSlide = !!uploadData.whole_slide_image;
                  const hasCellavision = uploadData.cellavision_images && Object.keys(uploadData.cellavision_images).length > 0;
                  
                  let uploadType = 'Unknown';
                  if (hasWholeSlide && hasCellavision) {
                    uploadType = 'Full Slide + Cellavision';
                  } else if (hasWholeSlide) {
                    uploadType = 'Full Slide';
                  } else if (hasCellavision) {
                    uploadType = 'Cellavision';
                  }
                  
                  const newUpload = {
                    id: job_id,
                    timestamp: new Date().toISOString(),
                    specimen: uploadData.common_name || 'Unknown Specimen',
                    scientific_name: uploadData.scientific_name,
                    type: uploadType,
                    status: uploadData.status,
                    contributor: uploadData.contributor,
                    collected_at: uploadData.collected_at,
                    source: uploadData.source,
                    uploadData: uploadData // Contains dzi_outputs and all data!
                  };
                  
                  // Update job status with full data including uploadData for viewer
                  setJobStatus({
                    status: uploadData.status,
                    message: '✅ Image ready for viewing!',
                    job_id: job_id,
                    uploadData: uploadData // Add this to access in JSX
                  });
                  
                  // Add to recent uploads
                  const updatedUploads = [newUpload, ...recentUploads.slice(0, 4)]; // Keep last 5 uploads
                  setRecentUploads(updatedUploads);
                  localStorage.setItem('recentUploads', JSON.stringify(updatedUploads));
                  
                  // Save to currentUploadData for other pages
                  localStorage.setItem('currentUploadData', JSON.stringify(uploadData));
                  
                  // Don't redirect automatically - let user view the image
                  alert('✅ Upload completed! Whole slide image is ready for viewing below.');
                  setIsProcessing(false);
                }
                
                // Stop polling after max attempts
                if (pollCount >= maxPolls) {
                  console.warn("Polling timeout - processing is taking longer than expected");
                  clearInterval(pollInterval);
                  alert('⏱️ Processing is taking longer than expected. You can check the status later from Recent Uploads page.');
                  navigate('/recent-uploads');
                }
              }
            } catch (error) {
              console.error('Failed to fetch upload data:', error);
              // Don't stop polling on error, continue trying
            }
          }, 5000); // Poll every 5 seconds
          
          // Reset form after successful upload
          setFormData({
            common_name: '',
            scientific_name: '',
            phylum: '',
            class: '',
            order: '',
            family: '',
            health_status: '',
            stain: '',
            contributor: '',
            collected_at: '',
            source: '',
            sex: '',
            age_years: '',
            age_months: '',
            age_days: '',
            magnification: '',
            scanner_type: '',
            disease: '',
            stain_other: '',
            phylum_other: '',
            fullSlideImage: null,
            cellTypes: [
              { type: 'Neutrophil', images: [], count: 0 },
              { type: 'Lymphocyte', images: [], count: 0 },
              { type: 'Monocyte', images: [], count: 0 },
              { type: 'Eosinophil', images: [], count: 0 },
              { type: 'Basophil', images: [], count: 0 },
              { type: 'Platelet', images: [], count: 0 },
              { type: 'Red Blood Cell', images: [], count: 0 }
            ]
          });
        } else {
          // Handle API error
          console.error('Upload failed:', result);
          alert(`Upload failed: ${result.message || 'Unknown error'}`);
        }
        
      } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed. Please try again.');
      } finally {
        setIsSubmitting(false);
        setIsProcessing(false);
      }
    }
  };
  

  const checkJobStatus = async () => {
    if (!currentJobId) return;
    
    setIsCheckingStatus(true);
    try {
      const response = await fetch(`${API_URL}/api/uploads/${currentJobId}`);
      const result = await response.json();
      
      if (response.ok && result.success) {
        const uploadData = result.data;
        
        // Save the complete upload data to localStorage for use in uploaded-content page
        localStorage.setItem('currentUploadData', JSON.stringify(uploadData));
        
        // Update job status with the current status
        setJobStatus({
          status: uploadData.status,
          message: getStatusMessage(uploadData.status),
          job_id: uploadData.job_id
        });
        
        console.log('Upload data saved:', uploadData);
      } else {
        alert(`Failed to check status: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Status check error:', error);
      alert('Failed to check job status. Please try again.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Helper function to get user-friendly status messages
  const getStatusMessage = (status) => {
    switch (status) {
      case 'processing':
        return 'Your upload is being processed...';
      case 'clean':
        return 'Upload processed successfully and cleaned!';
      case 'failed':
        return 'Upload processing failed.';
      case 'uploading_to_s3':
        return 'Uploading to cloud storage...';
      case 'uploaded_to_s3':
        return 'Successfully uploaded to cloud storage!';
      case 'ready_for_viewer':
        return '✅ Image ready for viewing!';
      case 'ready_for_access':
        return 'Upload is ready for access!';
      case 'partially_uploaded':
        return 'Some files uploaded successfully, others failed.';
      default:
        return 'Status unknown.';
    }
  };

  // Function to redirect to uploaded-content page with saved data
  const viewUploadedContent = () => {
    const savedData = localStorage.getItem('currentUploadData');
    if (savedData) {
      navigate('/uploaded-content', { 
        state: { 
          uploadData: JSON.parse(savedData) 
        } 
      });
    } else {
      alert('No upload data found. Please check job status first.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'received':
        return '#3b82f6'; // Blue
      case 'processing':
        return '#f59e0b'; // Amber
      case 'uploading_to_s3':
        return '#8b5cf6'; // Purple
      case 'uploaded_to_s3':
        return '#10b981'; // Green
      case 'ready_for_viewer':
        return '#059669'; // Dark Green
      case 'ready_for_access':
        return '#059669'; // Dark Green
      case 'clean':
        return '#10b981'; // Green
      case 'partially_uploaded':
        return '#f59e0b'; // Amber
      case 'failed':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'received':
        return '📥';
      case 'processing':
        return '⚙️';
      case 'uploading_to_s3':
        return '☁️';
      case 'uploaded_to_s3':
        return '✅';
      case 'ready_for_viewer':
        return '🎉';
      case 'ready_for_access':
        return '🎉';
      case 'clean':
        return '✨';
      case 'partially_uploaded':
        return '⚠️';
      case 'failed':
        return '❌';
      default:
        return '❓';
    }
  };

  return (
    <div className="admin-upload-page">
      <UCDavisNavbar />
      
      <div className="admin-upload-container">
        {/* Integrated Header - No separate card */}
        <div className="page-hero">
          <div className="hero-content">
            <h1>Admin Image Upload</h1>
            <div className="hero-buttons">
              <Link to="/recent-uploads" className="header-action-btn recent-btn">
                📋 Recent Uploads ({recentUploadsCount})
              </Link>
              <Link to="/uploaded-data" className="header-action-btn data-btn">
                📊 View All Uploaded Data
              </Link>
            </div>
          </div>
        </div>

        {/* Processing Message */}
        {isProcessing && (
          <div className="processing-container">
            <div className="processing-content">
              <div className="processing-icon">⚙️</div>
              <h3>Your image is being processed</h3>
              <p className="processing-message">Please wait while we process your upload...</p>
              <div className="processing-spinner">
                <div className="spinner"></div>
              </div>
              <p className="redirect-message">You will be redirected to Recent Uploads shortly.</p>
            </div>
          </div>
        )}

        {/* Upload Success Message */}
        {jobStatus && jobStatus.status === 'received' && !isProcessing && (
          <div className="upload-success-container">
            <div className="success-content">
              <div className="success-icon">✅</div>
              <h3>Upload Successful!</h3>
              <p className="success-message">{jobStatus.message}</p>
              <div className="job-id-display">
                <strong>Job ID:</strong> <span className="job-id">{jobStatus.job_id}</span>
                <button 
                  className="copy-job-id-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(jobStatus.job_id);
                    // Show temporary success message
                    const btn = document.querySelector('.copy-job-id-btn');
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    btn.style.background = '#10b981';
                    setTimeout(() => {
                      btn.textContent = originalText;
                      btn.style.background = '';
                    }, 2000);
                  }}
                  title="Copy Job ID to clipboard"
                >
                  📋 Copy
                </button>
              </div>
              <p className="redirect-message">
                Redirecting to Recent Uploads page in a few seconds...
              </p>
              <div className="redirect-actions">
                <button 
                  className="view-status-btn"
                  onClick={viewUploadedContent}
                >
                  View Uploaded Content
                </button>
                <button 
                  className="upload-another-btn"
                  onClick={() => {
                    setJobStatus(null);
                    setCurrentJobId(null);
                  }}
                >
                  Upload Another Image
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Whole Slide Viewer - Show when ready */}
        {jobStatus && jobStatus.status === 'ready_for_viewer' && jobStatus.uploadData?.dzi_outputs?.whole_slide?.length > 0 && (
          <div className="viewer-section">
            <div className="viewer-success-header">
              <div className="success-badge">
                <span className="success-icon">🎉</span>
                <div>
                  <h3>Upload Complete!</h3>
                  <p>Your whole slide image is ready to view</p>
                </div>
              </div>
              <div className="viewer-actions">
                <button 
                  className="view-recent-btn"
                  onClick={() => navigate('/recent-uploads')}
                >
                  📋 Go to Recent Uploads
                </button>
                <button 
                  className="upload-another-btn"
                  onClick={() => {
                    setJobStatus(null);
                    setCurrentJobId(null);
                    window.scrollTo(0, 0);
                  }}
                >
                  ⬆️ Upload Another Image
                </button>
              </div>
            </div>
            <WholeSlideViewer 
              dziUrl={jobStatus.uploadData.dzi_outputs.whole_slide[0]?.dzi_url}
              metadata={jobStatus.uploadData.dzi_outputs.whole_slide[0]}
            />
          </div>
        )}

        {/* Cellavision Only Success - Show when ready but no whole slide */}
        {jobStatus && jobStatus.status === 'ready_for_viewer' && !jobStatus.uploadData?.whole_slide_image && (
          <div className="viewer-section">
            <div className="viewer-success-header">
              <div className="success-badge">
                <span className="success-icon">🎉</span>
                <div>
                  <h3>Upload Complete!</h3>
                  <p>Your cellavision images are ready to view</p>
                </div>
              </div>
              <div className="viewer-actions">
                <button 
                  className="view-recent-btn"
                  onClick={() => navigate('/recent-uploads')}
                >
                  📋 Go to Recent Uploads
                </button>
                <button 
                  className="upload-another-btn"
                  onClick={() => {
                    setJobStatus(null);
                    setCurrentJobId(null);
                    window.scrollTo(0, 0);
                  }}
                >
                  ⬆️ Upload Another Image
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="upload-type-selector">
          <h2>Select Upload Type</h2>
          <div className="upload-type-buttons">
            <button
              type="button"
              className={`upload-type-btn ${uploadType === 'fullSlide' ? 'active' : ''}`}
              onClick={() => setUploadType('fullSlide')}
            >
              Full Slide Image
            </button>
            <button
              type="button"
              className={`upload-type-btn ${uploadType === 'cellavision' ? 'active' : ''}`}
              onClick={() => setUploadType('cellavision')}
            >
              Cellavision Images
            </button>
          </div>
        </div>

        <div className="upload-form-container">
          <form onSubmit={handleSubmit} className="upload-form">
            {/* Common Metadata Section */}
            <div className="form-section">
              <h3>Specimen Information</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="common_name">Common Name *</label>
                  <input
                    type="text"
                    id="common_name"
                    name="common_name"
                    value={formData.common_name}
                    onChange={handleInputChange}
                    className={errors.common_name ? 'error' : ''}
                    placeholder="e.g., Somali Ostrich"
                  />
                  {errors.common_name && <span className="error-message">{errors.common_name}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="scientific_name">Scientific Name *</label>
                  <input
                    type="text"
                    id="scientific_name"
                    name="scientific_name"
                    value={formData.scientific_name}
                    onChange={handleInputChange}
                    className={errors.scientific_name ? 'error' : ''}
                    placeholder="e.g., Struthio molybdophanes"
                  />
                  {errors.scientific_name && <span className="error-message">{errors.scientific_name}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phylum">Phylum</label>
                  <select
                    id="phylum"
                    name="phylum"
                    value={formData.phylum}
                    onChange={handleInputChange}
                  >
                    <option value="">Select phylum</option>
                    <option value="Porifera">Porifera (Sponges)</option>
                    <option value="Cnidaria">Cnidaria (Jellyfish, Corals, Anemones)</option>
                    <option value="Ctenophora">Ctenophora (Comb jellies)</option>
                    <option value="Platyhelminthes">Platyhelminthes (Flatworms)</option>
                    <option value="Nematoda">Nematoda (Roundworms)</option>
                    <option value="Rotifera">Rotifera</option>
                    <option value="Annelida">Annelida (Segmented worms)</option>
                    <option value="Mollusca">Mollusca (Snails, Clams, Octopus, etc.)</option>
                    <option value="Arthropoda">Arthropoda (Insects, Crustaceans, Spiders, etc.)</option>
                    <option value="Echinodermata">Echinodermata (Starfish, Sea Urchins, etc.)</option>
                    <option value="Chordata">Chordata (Vertebrates + a few others)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Conditional Other Phylum Field */}
                {formData.phylum === 'Other' && (
                  <div className="form-group">
                    <label htmlFor="phylum_other">Specify Other Phylum</label>
                    <input
                      type="text"
                      id="phylum_other"
                      name="phylum_other"
                      value={formData.phylum_other}
                      onChange={handleInputChange}
                      placeholder="e.g., Bryozoa, Brachiopoda, etc."
                    />
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="class">Class</label>
                  <select
                    id="class"
                    name="class"
                    value={formData.class}
                    onChange={handleInputChange}
                    disabled={!formData.phylum}
                  >
                    <option value="">Select class</option>
                    {formData.phylum && phylumClassMapping[formData.phylum]?.map(className => (
                      <option key={className} value={className}>{className}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="order">Order</label>
                  <input
                    type="text"
                    id="order"
                    name="order"
                    value={formData.order}
                    onChange={handleInputChange}
                    placeholder="e.g., Struthioniformes"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="family">Family</label>
                  <input
                    type="text"
                    id="family"
                    name="family"
                    value={formData.family}
                    onChange={handleInputChange}
                    placeholder="e.g., Struthionidae"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="health_status">Health Status</label>
                  <select
                    id="health_status"
                    name="health_status"
                    value={formData.health_status}
                    onChange={handleInputChange}
                  >
                    <option value="">Select health status</option>
                    <option value="Clinically Healthy">Clinically Healthy</option>
                    <option value="Diseased">Diseased</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="stain">Stain Type</label>
                  <select
                    id="stain"
                    name="stain"
                    value={formData.stain}
                    onChange={handleInputChange}
                  >
                    <option value="">Select stain type</option>
                    <option value="Diff-Quik">Diff-Quik</option>
                    <option value="Wright-Giemsa">Wright-Giemsa</option>
                    <option value="Acid-fast">Acid-fast</option>
                    <option value="New Methylene Blue">New Methylene Blue</option>
                    <option value="Grocott's Methenamine Silver (GMS)">Grocott's Methenamine Silver (GMS)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Conditional Other Stain Field */}
                {formData.stain === 'Other' && (
                  <div className="form-group">
                    <label htmlFor="stain_other">Specify Other Stain Type</label>
                    <input
                      type="text"
                      id="stain_other"
                      name="stain_other"
                      value={formData.stain_other}
                      onChange={handleInputChange}
                      placeholder="e.g., May-Grünwald-Giemsa, Romanowsky, etc."
                    />
                  </div>
                )}

                {/* Conditional Disease Field */}
                {formData.health_status === 'Diseased' && (
                  <div className="form-group">
                    <label htmlFor="disease">Disease Information</label>
                    <input
                      type="text"
                      id="disease"
                      name="disease"
                      value={formData.disease}
                      onChange={handleInputChange}
                      placeholder="e.g., Anemia, Leukemia, Infection"
                    />
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="contributor">Contributor *</label>
                  <input
                    type="text"
                    id="contributor"
                    name="contributor"
                    value={formData.contributor}
                    onChange={handleInputChange}
                    className={errors.contributor ? 'error' : ''}
                    placeholder="e.g., Dr. Hugues"
                  />
                  {errors.contributor && <span className="error-message">{errors.contributor}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="collected_at">Collection Date *</label>
                  <input
                    type="date"
                    id="collected_at"
                    name="collected_at"
                    value={formData.collected_at}
                    onChange={handleInputChange}
                    className={errors.collected_at ? 'error' : ''}
                  />
                  {errors.collected_at && <span className="error-message">{errors.collected_at}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="source">Source *</label>
                  <input
                    type="text"
                    id="source"
                    name="source"
                    value={formData.source}
                    onChange={handleInputChange}
                    className={errors.source ? 'error' : ''}
                    placeholder="e.g., Primate Center"
                  />
                  {errors.source && <span className="error-message">{errors.source}</span>}
                </div>
              </div>

              {/* Additional Optional Information */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="sex">Sex</label>
                  <select
                    id="sex"
                    name="sex"
                    value={formData.sex}
                    onChange={handleInputChange}
                  >
                    <option value="">Select sex</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Age</label>
                  <div className="age-inputs">
                    <div className="age-field">
                      <input
                        type="number"
                        id="age_years"
                        name="age_years"
                        value={formData.age_years}
                        onChange={handleInputChange}
                        placeholder="Years"
                        min="0"
                      />
                      <label htmlFor="age_years" className="age-label">Years</label>
                    </div>
                    <div className="age-field">
                      <input
                        type="number"
                        id="age_months"
                        name="age_months"
                        value={formData.age_months}
                        onChange={handleInputChange}
                        placeholder="Months"
                        min="0"
                        max="11"
                      />
                      <label htmlFor="age_months" className="age-label">Months</label>
                    </div>
                    <div className="age-field">
                      <input
                        type="number"
                        id="age_days"
                        name="age_days"
                        value={formData.age_days}
                        onChange={handleInputChange}
                        placeholder="Days"
                        min="0"
                        max="30"
                      />
                      <label htmlFor="age_days" className="age-label">Days</label>
                    </div>
                  </div>
                  <p className="age-help-text">Fill in any combination of age units (e.g., 2 years, 3 months, 15 days)</p>
                </div>

                <div className="form-group">
                  <label htmlFor="magnification">Magnification</label>
                  <select
                    id="magnification"
                    name="magnification"
                    value={formData.magnification}
                    onChange={handleInputChange}
                  >
                    <option value="">Select magnification</option>
                    <option value="40x">40x</option>
                    <option value="50x">50x</option>
                    <option value="60x">60x</option>
                    <option value="100x">100x</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="scanner_type">Scanner Type</label>
                  <select
                    id="scanner_type"
                    name="scanner_type"
                    value={formData.scanner_type}
                    onChange={handleInputChange}
                  >
                    <option value="">Select scanner type</option>
                    <option value="Olympus">Olympus</option>
                    <option value="Grundium">Grundium</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Upload Type Specific Section */}
            {uploadType === 'fullSlide' && (
              <div className="form-section">
                <h3>Full Slide Image</h3>
                <div className="form-group">
                  <label htmlFor="fullSlideImage">Upload Full Slide Image *</label>
                  <input
                    type="file"
                    id="fullSlideImage"
                    name="fullSlideImage"
                    accept=".tiff,.tif,.vsi,.ndpi,.svs"
                    onChange={handleFullSlideImageChange}
                    className={errors.fullSlideImage ? 'error' : ''}
                  />
                  <p className="file-help">Supported formats: TIFF, VSI, NDPI, SVS</p>
                  {errors.fullSlideImage && <span className="error-message">{errors.fullSlideImage}</span>}
                </div>
              </div>
            )}

            {uploadType === 'cellavision' && (
              <div className="form-section">
                <h3>Cellavision Images</h3>
               
                {formData.cellTypes.map((cellType, index) => (
                  <div key={index} className="cell-type-section">
                    <div className="cell-type-header">
                      <h4>{cellType.type}</h4>
                      <div className="cell-type-controls">
                        <span className="image-count">{cellType.count} images</span>
                        {formData.cellTypes.length > 1 && (
                          <button
                            type="button"
                            className="remove-cell-type-btn"
                            onClick={() => removeCellType(index)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor={`cellType-${index}`}>
                        Upload {cellType.type} Images
                      </label>
                      
                      {/* Always show the add images button */}
                      <div className="add-images-section">
                        <button
                          type="button"
                          className="add-images-btn"
                          onClick={() => document.getElementById(`cellType-${index}`).click()}
                        >
                          {cellType.images.length === 0 ? '+ Add Images' : '+ Add More Images'}
                        </button>
                        <input
                          type="file"
                          id={`cellType-${index}`}
                          name={`cellType-${index}`}
                          accept=".jpg,.jpeg,.png,.tiff,.tif"
                          multiple
                          onChange={(e) => handleCellTypeImageChange(index, e)}
                          style={{ display: 'none' }}
                        />
                        <p className="file-help">
                          {cellType.images.length === 0 
                            ? 'Click to select multiple images (JPG, PNG, TIFF)' 
                            : 'Click to add more images to this cell type'
                          }
                        </p>
                      </div>
                      
                      {/* Display selected images */}
                      {cellType.images.length > 0 && (
                        <div className="selected-images">
                          <div className="images-header">
                            <h5>Selected Images ({cellType.images.length})</h5>
                          </div>
                          <div className="image-list">
                            {cellType.images.map((image, imageIndex) => (
                              <div key={imageIndex} className="image-item">
                                <div className="image-info">
                                  <span className="image-name">{image.name}</span>
                                  <span className="image-size">({(image.size / 1024 / 1024).toFixed(2)} MB)</span>
                                </div>
                                <button
                                  type="button"
                                  className="remove-image-btn"
                                  onClick={() => removeImage(index, imageIndex)}
                                  title="Remove this image"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                <button
                  type="button"
                  className="add-cell-type-btn"
                  onClick={addCustomCellType}
                >
                  + Add Custom Cell Type
                </button>
                
                {errors.cellavision && <span className="error-message">{errors.cellavision}</span>}
              </div>
            )}

            <button 
              type="submit" 
              className="upload-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Uploading...' : 'Upload'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminUploadPage;
