import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import UCDavisNavbar from '../Component/UCDavisNavbar';
import WholeSlideViewer from '../Component/WholeSlideViewer';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import './UploadedContentPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const UploadedContentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [showWholeSlideViewer, setShowWholeSlideViewer] = useState(false);
  const [wholeSlideViewerData, setWholeSlideViewerData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(null);
  
  // Get upload data from location state or localStorage
  const uploadDataFromState = location.state?.uploadData;
  const uploadDataFromStorage = localStorage.getItem('currentUploadData');
  
  // Use data from state first, then localStorage
  const jobId = uploadDataFromState?.job_id || JSON.parse(uploadDataFromStorage || '{}').job_id || '';
  
  

  // Transform API data to match the expected format
  const transformApiData = (apiData) => {
    if (!apiData) return null;

    console.log('🔍 API Data:', apiData);
    console.log('🖼️ Whole Slide PNG URL:', apiData.whole_slide_image?.s3_storage?.png_url);
    
    // Helper function to get proper image URL
    const getImageUrl = (s3Storage) => {
      if (!s3Storage) return null;
      
      // PRIORITY 1: Use pre-converted PNG URL if available (from blob conversion)
      if (s3Storage.png_url) {
        console.log('✅ Using pre-converted PNG:', s3Storage.png_url);
        return s3Storage.png_url;
      }
      
      // PRIORITY 2: Use CloudFront URL for better performance
      if (s3Storage.cloudfront_url) {
        const cloudfrontUrl = s3Storage.cloudfront_url.startsWith('http') 
          ? s3Storage.cloudfront_url 
          : `https://${s3Storage.cloudfront_url}`;
        console.log('⚠️ Using CloudFront URL:', cloudfrontUrl);
        return cloudfrontUrl;
      }
      
      // PRIORITY 3: Fallback to S3 URL
      if (s3Storage.s3_url) {
        console.log('⚠️ Using S3 URL:', s3Storage.s3_url);
        return s3Storage.s3_url;
      }
      
      return null;
    };
    
    return {
      job_id: apiData.job_id,
      status: apiData.status,
      message: getStatusMessage(apiData.status),
      metadata: {
        common_name: apiData.common_name,
        scientific_name: apiData.scientific_name,
        phylum: apiData.taxonomy?.phylum,
        class: apiData.taxonomy?.class,
        order: apiData.taxonomy?.order,
        health_status: apiData.health_status,
        custom_health_status: apiData.custom_health_status,
        stain: apiData.stain,
        custom_stain: apiData.custom_stain,
        sex: apiData.sex,
        age: apiData.age ? `${apiData.age.years || 0} years, ${apiData.age.months || 0} months, ${apiData.age.days || 0} days` : '',
        scanner_type: apiData.scanner_type,
        magnification: apiData.magnification,
        contributor: apiData.contributor,
        collected_at: apiData.collected_at,
        source: apiData.source,
        approved: apiData.approved
      },
      whole_slide_image: apiData.whole_slide_image ? {
        filename: apiData.whole_slide_image.original_filename,
        url: getImageUrl(apiData.whole_slide_image.s3_storage),
        status: apiData.whole_slide_image.s3_storage?.upload_success ? 'completed' : 'failed',
        file_size: `${(apiData.whole_slide_image.size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`,
        resolution: 'Unknown',
        s3_url: apiData.whole_slide_image.s3_storage?.s3_url,
        cloudfront_url: apiData.whole_slide_image.s3_storage?.cloudfront_url,
        png_url: apiData.whole_slide_image.s3_storage?.png_url,
        original_tiff_url: apiData.whole_slide_image.s3_storage?.original_tiff_url,
        // Add DZI data for OpenSeadragon viewer
        has_dzi: apiData.dzi_outputs?.whole_slide?.length > 0,
        dzi_url: apiData.dzi_outputs?.whole_slide?.[0]?.dzi_url,
        dzi_metadata: apiData.dzi_outputs?.whole_slide?.[0]
      } : null,
      cellavision_images: apiData.cellavision_images ? Object.entries(apiData.cellavision_images).reduce((acc, [cellType, images]) => {
        acc[cellType.toLowerCase()] = images.map(img => ({
          filename: img.original_filename,
          url: getImageUrl(img.s3_storage),
          status: img.s3_storage?.upload_success ? 'completed' : 'failed',
          cell_count: 1, // Default value
          s3_url: img.s3_storage?.s3_url,
          cloudfront_url: img.s3_storage?.cloudfront_url,
          png_url: img.s3_storage?.png_url,
          original_tiff_url: img.s3_storage?.original_tiff_url
        }));
        return acc;
      }, {}) : {},
      s3_upload_summary: apiData.s3_upload_summary,
      created_at: apiData.created_at,
      updated_at: apiData.updated_at
    };
  };

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
      case 'ready_for_access':
        return 'Upload is ready for access!';
      case 'partially_uploaded':
        return 'Some files uploaded successfully, others failed.';
      default:
        return 'Status unknown.';
    }
  };

  // Get the actual data from API
  const apiData = uploadDataFromState || (uploadDataFromStorage ? JSON.parse(uploadDataFromStorage) : null);
  // console.log('🔍 API Data:', apiData);
  // console.log('�� Cellavision Images:', apiData?.cellavision_images);
  // console.log('�� Whole Slide:', apiData?.whole_slide_image);

  const transformedApiData = transformApiData(apiData);
  
  // 🖼️ Print PNG URLs for testing in browser
  if (transformedApiData?.whole_slide_image?.png_url) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎨 WHOLE SLIDE PNG URL (Copy & Test in Browser):');
    console.log(transformedApiData.whole_slide_image.png_url);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
  
  if (transformedApiData?.cellavision_images) {
    const cellavisionPngs = [];
    Object.entries(transformedApiData.cellavision_images).forEach(([cellType, images]) => {
      if (Array.isArray(images)) {
        images.forEach((img, idx) => {
          if (img.png_url) {
            cellavisionPngs.push({ cellType, index: idx, url: img.png_url, filename: img.filename });
          }
        });
      }
    });
    
    if (cellavisionPngs.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎨 CELLAVISION PNG URLs (Copy & Test in Browser):');
      cellavisionPngs.forEach((png, i) => {
        console.log(`${i + 1}. [${png.cellType}] ${png.filename}:`);
        console.log(png.url);
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  }
  // console.log('✅ Transformed Data:', transformedApiData);
  // console.log('✅ Transformed Cellavision:', transformedApiData?.cellavision_images);
  const jobData = editedData || transformedApiData;

  // Initialize edited data when component mounts
  useEffect(() => {
    if (transformedApiData) {
      setEditedData(JSON.parse(JSON.stringify(transformedApiData)));
    }
  }, [jobId, transformedApiData]);

  useEffect(() => {
    const fetchLatestData = async () => {
      if (jobId) {
        try {
          const response = await fetch(`${API_URL}/api/uploads/${jobId}`);
          const result = await response.json();
          
          if (response.ok && result.success) {
            // Update localStorage with fresh data
            localStorage.setItem('currentUploadData', JSON.stringify(result.data));
            
            // Transform and set the data
            const transformed = transformApiData(result.data);
            setEditedData(JSON.parse(JSON.stringify(transformed)));
          }
        } catch (error) {
          console.error('Failed to fetch latest data:', error);
        }
      }
    };
    
    fetchLatestData();
  }, [jobId]); // Run when component mounts or jobId changes

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    if (isEditing) {
      // If canceling edit, reset to original data
      const originalData = transformedApiData;
      if (originalData) {
        setEditedData(JSON.parse(JSON.stringify(originalData)));
      }
    }
  };

  const handleSave = () => {
    // Here you would typically save to backend
    console.log('Saving data:', editedData);
    setIsEditing(false);
    // You could add a success notification here
  };

  const handleFieldChange = (field, value) => {
    setEditedData(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [field]: value
      }
    }));
  };

  const copyJobId = () => {
    navigator.clipboard.writeText(jobData.job_id);
    // You could add a toast notification here
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'ready_for_access':
      case 'ready_for_viewer':
        return '#10b981';
      case 'processing':
        return '#fbbf24';
      case 'uploaded_to_s3':
        return '#34d399';
      case 'failed':
        return '#f87171';
      default:
        return '#9ca3af';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
      case 'ready_for_access':
      case 'ready_for_viewer':
        return '🎉';
      case 'processing':
        return '⚙️';
      case 'uploaded_to_s3':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
      case 'ready_for_access':
      case 'ready_for_viewer':
        return 'READY TO VIEW';
      case 'processing':
        return 'PROCESSING';
      case 'uploaded_to_s3':
        return 'UPLOADED';
      case 'failed':
        return 'FAILED';
      default:
        return status ? status.toUpperCase().replace(/_/g, ' ') : 'UNKNOWN';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleImageClick = (image, event, isWholeSlide = false) => {
    event.stopPropagation();
    
    // If it's a whole slide image with DZI data, show OpenSeadragon viewer
    if (isWholeSlide && image.has_dzi && image.dzi_url) {
      setWholeSlideViewerData({
        dziUrl: image.dzi_url,
        metadata: image.dzi_metadata,
        filename: image.filename
      });
      setShowWholeSlideViewer(true);
    } else {
      // For cellavision images, show fullscreen modal with zoom
      setFullscreenImage(image);
    }
  };

  const closeFullscreenImage = () => {
    setFullscreenImage(null);
  };

  const closeWholeSlideViewer = () => {
    setShowWholeSlideViewer(false);
    setWholeSlideViewerData(null);
  };

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        if (fullscreenImage) {
          closeFullscreenImage();
        }
        if (showWholeSlideViewer) {
          closeWholeSlideViewer();
        }
      }
    };

    if (fullscreenImage || showWholeSlideViewer) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [fullscreenImage, showWholeSlideViewer]);

  if (!jobData) {
    return (
      <div className="uploaded-content-page">
        <UCDavisNavbar />
        <div className="content-container">
          <div className="error-message">
            <h2>Job Not Found</h2>
            <p>Job ID "{jobId}" not found. Please check your job ID and try again.</p>
            <button 
              className="back-btn"
              onClick={() => navigate('/recent-uploads')}
            >
              ← Back to Recent Uploads
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="uploaded-content-page">
      <UCDavisNavbar />
      
      <div className="content-container">
        {/* Header */}
        <div className="content-header">
          <div className="header-content">
            <div className="header-text">
              <h1>📋 Uploaded Content</h1>
              <p>Detailed view of uploaded images and metadata</p>
              <div className="job-id-compact">
                <div className="job-id-info">
                  <span className="job-id-label">Job ID:</span>
                  <span className="job-id-value">{jobData.job_id}</span>
                  <button 
                    className="copy-job-id-compact-btn"
                    onClick={copyJobId}
                    title="Copy Job ID to clipboard"
                  >
                    📋 Copy
                  </button>
                </div>
                <span 
                  className="status-badge-compact"
                  style={{ backgroundColor: getStatusColor(jobData.status) }}
                >
                  {getStatusIcon(jobData.status)} {getStatusText(jobData.status)}
                </span>
              </div>
            </div>
            <div className="header-actions">
              <button 
                className={isEditing ? "cancel-btn" : "edit-btn"}
                onClick={handleEditToggle}
              >
                {isEditing ? "❌ Cancel" : "✏️ Edit"}
              </button>
              {isEditing && (
                <button 
                  className="save-btn"
                  onClick={handleSave}
                >
                  💾 Save Changes
                </button>
              )}
              <button 
                className="back-btn"
                onClick={() => navigate('/recent-uploads')}
              >
                ← Back to Recent Uploads
              </button>
              <button 
                className="status-btn"
                onClick={() => navigate('/job-status')}
              >
                👁️ Job Status
              </button>
            </div>
          </div>
        </div>

        {/* Metadata Section */}
        <div className="metadata-section">
          <h3>Specimen Information</h3>
          <div className="metadata-grid">
            <div className="metadata-group">
              <h4>Taxonomy</h4>
              <div className="metadata-item">
                <label>Common Name:</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={jobData.metadata.common_name}
                    onChange={(e) => handleFieldChange('common_name', e.target.value)}
                    className="edit-input"
                  />
                ) : (
                  <span>{jobData.metadata.common_name}</span>
                )}
              </div>
              <div className="metadata-item">
                <label>Scientific Name:</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={jobData.metadata.scientific_name}
                    onChange={(e) => handleFieldChange('scientific_name', e.target.value)}
                    className="edit-input"
                  />
                ) : (
                  <span>{jobData.metadata.scientific_name}</span>
                )}
              </div>
              <div className="metadata-item">
                <label>Phylum:</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={jobData.metadata.phylum}
                    onChange={(e) => handleFieldChange('phylum', e.target.value)}
                    className="edit-input"
                  />
                ) : (
                  <span>{jobData.metadata.phylum}</span>
                )}
              </div>
              <div className="metadata-item">
                <label>Class:</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={jobData.metadata.class}
                    onChange={(e) => handleFieldChange('class', e.target.value)}
                    className="edit-input"
                  />
                ) : (
                  <span>{jobData.metadata.class}</span>
                )}
              </div>
              <div className="metadata-item">
                <label>Order:</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={jobData.metadata.order}
                    onChange={(e) => handleFieldChange('order', e.target.value)}
                    className="edit-input"
                  />
                ) : (
                  <span>{jobData.metadata.order}</span>
                )}
              </div>
            </div>

            <div className="metadata-group">
              <h4>Health & Staining</h4>
              <div className="metadata-item">
                <label>Health Status:</label>
                {isEditing ? (
                  <select
                    value={jobData.metadata.health_status}
                    onChange={(e) => handleFieldChange('health_status', e.target.value)}
                    className="edit-select"
                  >
                    <option value="Clinically Healthy">Clinically Healthy</option>
                    <option value="Sick">Sick</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                ) : (
                  <span>{jobData.metadata.health_status}</span>
                )}
              </div>
              <div className="metadata-item">
                <label>Custom Health Status:</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={jobData.metadata.custom_health_status || ''}
                    onChange={(e) => handleFieldChange('custom_health_status', e.target.value)}
                    className="edit-input"
                    placeholder="Enter custom health status"
                  />
                ) : (
                  <span>{jobData.metadata.custom_health_status || 'N/A'}</span>
                )}
              </div>
              <div className="metadata-item">
                <label>Stain:</label>
                {isEditing ? (
                  <select
                    value={jobData.metadata.stain}
                    onChange={(e) => handleFieldChange('stain', e.target.value)}
                    className="edit-select"
                  >
                    <option value="Wright-Giemsa">Wright-Giemsa</option>
                    <option value="H&E">H&E</option>
                    <option value="PAS">PAS</option>
                    <option value="Other">Other</option>
                  </select>
                ) : (
                  <span>{jobData.metadata.stain}</span>
                )}
              </div>
              <div className="metadata-item">
                <label>Custom Stain:</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={jobData.metadata.custom_stain || ''}
                    onChange={(e) => handleFieldChange('custom_stain', e.target.value)}
                    className="edit-input"
                    placeholder="Enter custom stain"
                  />
                ) : (
                  <span>{jobData.metadata.custom_stain || 'N/A'}</span>
                )}
              </div>
            </div>

            <div className="metadata-group">
              <h4>Specimen Details</h4>
              <div className="metadata-item">
                <label>Sex:</label>
                {isEditing ? (
                  <select
                    value={jobData.metadata.sex}
                    onChange={(e) => handleFieldChange('sex', e.target.value)}
                    className="edit-select"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                ) : (
                  <span>{jobData.metadata.sex}</span>
                )}
              </div>
              <div className="metadata-item">
                <label>Age:</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={jobData.metadata.age}
                    onChange={(e) => handleFieldChange('age', e.target.value)}
                    className="edit-input"
                    placeholder="e.g., 3 years, 5 months"
                  />
                ) : (
                  <span>{jobData.metadata.age}</span>
                )}
              </div>
              <div className="metadata-item">
                <label>Scanner Type:</label>
                {isEditing ? (
                  <select
                    value={jobData.metadata.scanner_type}
                    onChange={(e) => handleFieldChange('scanner_type', e.target.value)}
                    className="edit-select"
                  >
                    <option value="Olympus">Olympus</option>
                    <option value="Leica">Leica</option>
                    <option value="Nikon">Nikon</option>
                    <option value="Other">Other</option>
                  </select>
                ) : (
                  <span>{jobData.metadata.scanner_type}</span>
                )}
              </div>
              <div className="metadata-item">
                <label>Magnification:</label>
                {isEditing ? (
                  <select
                    value={jobData.metadata.magnification}
                    onChange={(e) => handleFieldChange('magnification', e.target.value)}
                    className="edit-select"
                  >
                    <option value="10x">10x</option>
                    <option value="20x">20x</option>
                    <option value="40x">40x</option>
                    <option value="60x">60x</option>
                    <option value="100x">100x</option>
                  </select>
                ) : (
                  <span>{jobData.metadata.magnification}</span>
                )}
              </div>
            </div>

            <div className="metadata-group">
              <h4>Collection Info</h4>
              <div className="metadata-item">
                <label>Contributor:</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={jobData.metadata.contributor}
                    onChange={(e) => handleFieldChange('contributor', e.target.value)}
                    className="edit-input"
                  />
                ) : (
                  <span>{jobData.metadata.contributor}</span>
                )}
              </div>
              <div className="metadata-item">
                <label>Collection Date:</label>
                {isEditing ? (
                  <input
                    type="date"
                    value={jobData.metadata.collected_at.split('T')[0]}
                    onChange={(e) => handleFieldChange('collected_at', e.target.value + 'T00:00:00.000+00:00')}
                    className="edit-input"
                  />
                ) : (
                  <span>{formatDate(jobData.metadata.collected_at)}</span>
                )}
              </div>
              <div className="metadata-item">
                <label>Source:</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={jobData.metadata.source}
                    onChange={(e) => handleFieldChange('source', e.target.value)}
                    className="edit-input"
                  />
                ) : (
                  <span>{jobData.metadata.source}</span>
                )}
              </div>
              <div className="metadata-item">
                <label>Approved:</label>
                {isEditing ? (
                  <select
                    value={jobData.metadata.approved}
                    onChange={(e) => handleFieldChange('approved', e.target.value === 'true')}
                    className="edit-select"
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <span className={jobData.metadata.approved ? 'approved' : 'not-approved'}>
                    {jobData.metadata.approved ? '✅ Yes' : '❌ No'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Images Section */}
        <div className="images-section">
          <h3>Uploaded Images</h3>
          
          {/* Whole Slide Image */}
          {jobData.whole_slide_image && (
            <div className="image-category">
              <h4>Whole Slide Image</h4>
              <div className="image-card">
                <div className="image-preview">
                  {jobData.whole_slide_image.has_dzi ? (
                    // Show placeholder with "View in Viewer" button for DZI images
                    <div className="dzi-placeholder" onClick={(e) => handleImageClick(jobData.whole_slide_image, e, true)}>
                      <div className="dzi-placeholder-content">
                        <div className="dzi-icon">🔬</div>
                        <h5>Whole Slide Image Available</h5>
                        <p>Click to view in interactive viewer</p>
                        <button className="view-dzi-btn">
                          🔍 Open Viewer
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Show regular image for non-DZI images
                    <img 
                      src={jobData.whole_slide_image.url} 
                      alt={jobData.whole_slide_image.filename}
                      onClick={(e) => handleImageClick(jobData.whole_slide_image, e, false)}
                      className="clickable-image"
                    />
                  )}
                  <div className="image-status-overlay">
                    <span 
                      className="image-status-badge"
                      style={{
                        backgroundColor: getStatusColor(jobData.whole_slide_image.status) + '20',
                        color: getStatusColor(jobData.whole_slide_image.status),
                        border: `1px solid ${getStatusColor(jobData.whole_slide_image.status)}40`
                      }}
                    >
                      {getStatusIcon(jobData.whole_slide_image.status)} {jobData.whole_slide_image.status}
                    </span>
                  </div>
                </div>
                <div className="image-info">
                  <h5 className="scientific-name-display">
                    <em>{jobData.metadata.scientific_name || 'Scientific name not available'}</em>
                  </h5>
                  <div className="image-details">
                    <p><strong>File Size:</strong> {jobData.whole_slide_image.file_size}</p>
                    {jobData.whole_slide_image.has_dzi && jobData.whole_slide_image.dzi_metadata && (
                      <>
                        <p><strong>Resolution:</strong> {jobData.whole_slide_image.dzi_metadata.image_width?.toLocaleString()} × {jobData.whole_slide_image.dzi_metadata.image_height?.toLocaleString()} px</p>
                        <p><strong>Zoom Levels:</strong> {jobData.whole_slide_image.dzi_metadata.pyramid_levels}</p>
                        <p><strong>Tiles:</strong> {jobData.whole_slide_image.dzi_metadata.tile_count?.toLocaleString()}</p>
                      </>
                    )}
                    {!jobData.whole_slide_image.has_dzi && (
                      <p><strong>Resolution:</strong> {jobData.whole_slide_image.resolution}</p>
                    )}
                    {jobData.whole_slide_image.status === 'completed' && (
                      <>
                        <p><strong>Processing Time:</strong> {jobData.whole_slide_image.processing_time}</p>
                        <p><strong>Completed:</strong> {formatDate(jobData.whole_slide_image.completed_at)}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cellavision Images - FIXED */}
          {jobData.cellavision_images && Object.keys(jobData.cellavision_images).length > 0 && (
            <div className="image-category">
              <h4>Cellavision Images</h4>
              {Object.entries(jobData.cellavision_images).map(([cellType, images]) => (
                <div key={cellType} className="cell-type-section">
                  <h5>{cellType.charAt(0).toUpperCase() + cellType.slice(1)}</h5>
                  <div className="cellavision-grid">
                    {Array.isArray(images) ? images.map((imageData, index) => (
                      <div key={index} className="image-card">
                        <div className="image-preview">
                          <img 
                            src={imageData.url} 
                            alt={imageData.filename}
                            onClick={(e) => handleImageClick(imageData, e)}
                            className="clickable-image"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                          />
                          <div className="image-status-overlay">
                            <span 
                              className="image-status-badge"
                              style={{
                                backgroundColor: getStatusColor(imageData.status) + '20',
                                color: getStatusColor(imageData.status),
                                border: `1px solid ${getStatusColor(imageData.status)}40`
                              }}
                            >
                              {getStatusIcon(imageData.status)} {imageData.status}
                            </span>
                          </div>
                        </div>
                        <div className="image-info">
                          <p><strong>Cell Count:</strong> {imageData.cell_count || 'N/A'}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="image-card">
                        <div className="image-preview">
                          <img 
                            src={images.url} 
                            alt={images.filename}
                            onClick={(e) => handleImageClick(images, e)}
                            className="clickable-image"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Processing Summary */}
        {jobData.status === 'completed' && (
          <div className="processing-summary">
            <h3>Processing Summary</h3>
            <div className="summary-details">
              <p><strong>Total Processing Time:</strong> {jobData.processing_time}</p>
              <p><strong>Completed At:</strong> {formatDate(jobData.completed_at)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Full-Screen Image Viewer Modal with Zoom (for cellavision images) */}
      {fullscreenImage && (
        <div className="fullscreen-image-modal" onClick={closeFullscreenImage}>
          <div className="fullscreen-image-container" onClick={(e) => e.stopPropagation()}>
            <div className="fullscreen-image-header">
              <h3>{fullscreenImage.filename}</h3>
              <button className="close-fullscreen-btn" onClick={closeFullscreenImage}>×</button>
            </div>
            <div className="fullscreen-image-content">
              <TransformWrapper
                initialScale={1}
                minScale={1}
                maxScale={8}
                doubleClick={{ mode: "reset" }}
                wheel={{ step: 0.1 }}
              >
                <TransformComponent
                  wrapperStyle={{ width: '100%', height: '100%' }}
                  contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <img 
                    src={fullscreenImage.url} 
                    alt={fullscreenImage.filename}
                    className="fullscreen-image"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </TransformComponent>
              </TransformWrapper>
            </div>
            <div className="fullscreen-image-footer">
              <p className="image-instructions">
                🖱️ Scroll to zoom • Drag to pan • Double-click to reset • Press ESC to close
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Whole Slide Viewer Modal (for DZI images with OpenSeadragon) */}
      {showWholeSlideViewer && wholeSlideViewerData && (
        <div className="whole-slide-viewer-modal" onClick={closeWholeSlideViewer}>
          <div className="whole-slide-viewer-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="whole-slide-viewer-modal-header">
              <div className="viewer-modal-title">
                <h3>🔬 {wholeSlideViewerData.filename}</h3>
                <p className="viewer-modal-subtitle">Interactive Whole Slide Viewer</p>
              </div>
              <button className="close-viewer-btn" onClick={closeWholeSlideViewer}>
                ✕ Close
              </button>
            </div>
            <div className="whole-slide-viewer-modal-content">
              <WholeSlideViewer 
                dziUrl={wholeSlideViewerData.dziUrl}
                metadata={wholeSlideViewerData.metadata}
              />
            </div>
            <div className="whole-slide-viewer-modal-footer">
              <p className="viewer-instructions">
                🖱️ Use mouse to pan • Scroll to zoom • Press ESC to close
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadedContentPage;
