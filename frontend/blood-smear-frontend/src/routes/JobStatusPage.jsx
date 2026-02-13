import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import UCDavisNavbar from '../Component/UCDavisNavbar';
import './JobStatusPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const JobStatusPage = () => {
  const location = useLocation();
  const [searchJobId, setSearchJobId] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null); // For full-screen image viewer
  
  // Get job ID from location state (if redirected from upload)
  const initialJobId = location.state?.jobId || '';
  const [currentJobId, setCurrentJobId] = useState(initialJobId);


  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchJobId.trim()) return;

    setIsSearching(true);
    
    try {
      const response = await fetch(`${API_URL}/api/uploads/${searchJobId}`);
      const result = await response.json();
      
      if (response.ok && result.success) {
        setSearchResults(result.data);
        setCurrentJobId(searchJobId);
      } else {
        setSearchResults({ error: 'Job ID not found. Please check your job ID and try again.' });
      }
    } catch (error) {
      console.error('Failed to fetch job data:', error);
      setSearchResults({ error: 'Failed to fetch job data. Please try again.' });
    }
    
    setIsSearching(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#10b981'; // Green
      case 'processing':
        return '#f59e0b'; // Amber
      case 'failed':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'processing':
        return '⚙️';
      case 'failed':
        return '❌';
      default:
        return '❓';
    }
  };

  const getImageStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'processing':
        return '#f59e0b';
      case 'failed':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getImageStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'processing':
        return 'Processing';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
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

  const handleImageClick = (image, event) => {
    event.stopPropagation(); // Prevent any other click handlers
    setFullscreenImage(image);
  };

  const closeFullscreenImage = () => {
    setFullscreenImage(null);
  };

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && fullscreenImage) {
        closeFullscreenImage();
      }
    };

    if (fullscreenImage) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [fullscreenImage]);

  return (
    <div className="job-status-page">
      <UCDavisNavbar />
      
      <div className="job-status-container">
        <div className="job-status-header">
          <div className="header-content">
            <div className="header-text">
              <h1>Job Status & Search</h1>
              <p>Check the status of your image uploads and view processing results</p>
            </div>
            <div className="header-right">
              <Link to="/admin/upload" className="upload-new-btn">
                + Upload New Images
              </Link>
              <Link to="/" className="go-home-btn">
                🏠 Home
              </Link>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="search-section">
          <div className="search-container">
            <h2>Check Job Status</h2>
            <p>Enter your Job ID to check the status and view results</p>
            
            <form onSubmit={handleSearch} className="search-form">
              <div className="search-input-group">
                <input
                  type="text"
                  value={searchJobId}
                  onChange={(e) => setSearchJobId(e.target.value)}
                  placeholder="Enter Job ID (e.g., job-12345)"
                  className="search-input"
                  required
                />
                <button 
                  type="submit" 
                  className="search-btn"
                  disabled={isSearching}
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </form>

          </div>
        </div>

        {/* Results Section */}
        {searchResults && (
          <div className="results-section">
            {searchResults.error ? (
              <div className="error-message">
                <div className="error-icon">⚠️</div>
                <h3>Job Not Found</h3>
                <p>{searchResults.error}</p>
              </div>
            ) : (
              <div className="job-details">
                <div className="job-header">
                  <div className="job-id-display">
                    <h2>Job ID: {currentJobId}</h2>
                    <div className="status-badge">
                      <span className="status-icon">{getStatusIcon(searchResults.status)}</span>
                      <span 
                        className="status-text"
                        style={{ color: getStatusColor(searchResults.status) }}
                      >
                        {searchResults.status.charAt(0).toUpperCase() + searchResults.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  <div className="job-message">
                    <p>{searchResults.message}</p>
                  </div>
                </div>

                {/* Metadata Section */}
                <div className="metadata-section">
                  <div className="metadata-grid">
                    <div className="metadata-item">
                      <label>Common Name:</label>
                      <span>{searchResults.metadata.common_name}</span>
                    </div>
                    <div className="metadata-item">
                      <label>Scientific Name:</label>
                      <span>{searchResults.metadata.scientific_name}</span>
                    </div>
                    <div className="metadata-item">
                      <label>Contributor:</label>
                      <span>{searchResults.metadata.contributor}</span>
                    </div>
                    <div className="metadata-item">
                      <label>Collection Date:</label>
                      <span>{searchResults.metadata.collected_at}</span>
                    </div>
                    <div className="metadata-item">
                      <label>Source:</label>
                      <span>{searchResults.metadata.source}</span>
                    </div>
                    <div className="metadata-item">
                      <label>Upload Type:</label>
                      <span>{searchResults.metadata.upload_type}</span>
                    </div>
                  </div>
                </div>

                {/* Images Section */}
                <div className="images-section">
                  <h3>Uploaded Images</h3>
                  <div className="images-grid">
                    {searchResults.images.map((image, index) => (
                      <div key={index} className="image-card">
                        <div className="image-preview">
                          <img 
                            src={image.url} 
                            alt={image.filename}
                            onClick={(e) => handleImageClick(image, e)}
                            className="clickable-image"
                            onError={(e) => {
                               e.target.src = 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400&h=300&fit=crop';
                               e.target.alt = 'Fallback Image';
                             }}
                          />
                          <div className="image-status-overlay">
                            <span 
                              className="image-status-badge"
                              style={{
                                backgroundColor: getImageStatusColor(image.status) + '20',
                                color: getImageStatusColor(image.status),
                                border: `1px solid ${getImageStatusColor(image.status)}40`
                              }}
                            >
                              {getStatusIcon(image.status)} {getImageStatusText(image.status)}
                            </span>
                          </div>
                        </div>
                        <div className="image-info">
                          <h4>{image.type.replace('_', ' ').toUpperCase()}</h4>
                          <p className="filename">{image.filename}</p>
                          
                          {/* Image-specific status information */}
                          {image.status === 'completed' && image.processing_time && (
                            <div className="image-status-details">
                              <p className="processing-time">
                                <strong>Processing Time:</strong> {image.processing_time}
                              </p>
                              {image.completed_at && (
                                <p className="completed-at">
                                  <strong>Completed:</strong> {formatDate(image.completed_at)}
                                </p>
                              )}
                            </div>
                          )}
                          
                          {image.status === 'processing' && image.estimated_completion && (
                            <div className="image-status-details">
                              <p className="estimated-completion">
                                <strong>Estimated:</strong> {image.estimated_completion}
                              </p>
                            </div>
                          )}
                          
                          {image.status === 'failed' && image.error_details && (
                            <div className="image-status-details">
                              <p className="error-details">
                                <strong>Error:</strong> {image.error_details}
                              </p>
                              {image.failed_at && (
                                <p className="failed-at">
                                  <strong>Failed:</strong> {formatDate(image.failed_at)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Specific Information */}
                {searchResults.status === 'completed' && (
                  <div className="completion-info">
                    <h3>Processing Complete</h3>
                    <div className="completion-details">
                      <div className="detail-item">
                        <label>Processing Time:</label>
                        <span>{searchResults.processing_time}</span>
                      </div>
                      <div className="detail-item">
                        <label>Completed At:</label>
                        <span>{formatDate(searchResults.completed_at)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {searchResults.status === 'processing' && (
                  <div className="processing-info">
                    <h3>Currently Processing</h3>
                    <div className="processing-details">
                      <div className="detail-item">
                        <label>Estimated Completion:</label>
                        <span>{searchResults.estimated_completion}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill"></div>
                      </div>
                    </div>
                  </div>
                )}

                {searchResults.status === 'failed' && (
                  <div className="failure-info">
                    <h3>Processing Failed</h3>
                    <div className="failure-details">
                      <div className="detail-item">
                        <label>Error Details:</label>
                        <span>{searchResults.error_details}</span>
                      </div>
                      <div className="detail-item">
                        <label>Failed At:</label>
                        <span>{formatDate(searchResults.failed_at)}</span>
                      </div>
                    </div>
                    <div className="failure-actions">
                      <button className="retry-btn">Retry Upload</button>
                      <button className="contact-support-btn">Contact Support</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Welcome Message for New Users */}
        {!searchResults && !currentJobId && (
          <div className="welcome-section">
            <div className="welcome-content">
              <div className="welcome-icon">🔍</div>
              <h2>Welcome to Job Status</h2>
              <p>Use the search bar above to check the status of your image uploads. You'll be able to:</p>
              <ul className="welcome-features">
                <li>✅ View upload metadata and specimen information</li>
                <li>🖼️ See uploaded images and processing results</li>
                <li>📊 Track processing status and completion times</li>
                <li>⚠️ Get detailed error information if processing fails</li>
              </ul>
              
              {/* Help for users who forgot their Job ID */}
              <div className="forgot-job-id-help">
                <h3>🔑 Forgot Your Job ID?</h3>
                <p>Don't worry! You can:</p>
                <ul className="help-options">
                  <li>📋 <strong>Go back to Admin Upload</strong> - Your recent uploads are saved there</li>
                  <li>🔍 <strong>Use sample Job IDs</strong> - Try the demo IDs above to see how it works</li>
                  <li>📱 <strong>Check your email</strong> - Job IDs are typically sent via email</li>
                  <li>💬 <strong>Contact support</strong> - We can help you find your Job ID</li>
                </ul>
                <div className="help-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => window.history.back()}
                  >
                    ← Go Back to Upload
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => navigate('/admin/upload')}
                  >
                    📤 Admin Upload Page
                  </button>
                </div>
              </div>
              
            </div>
          </div>
        )}

        {/* User Sidebar */}
        <div className="user-sidebar">
          <div className="user-profile-card">
            <div className="user-avatar">
              <span className="avatar-text">👤</span>
            </div>
            <div className="user-info">
              <h3 className="username">Dr. Sarah Johnson</h3>
              <p className="user-role">Administrator</p>
              <p className="user-department">UC Davis Primate Center</p>
            </div>
            <div className="user-stats">
              <div className="user-stat-item">
                <span className="stat-number">12</span>
                <span className="stat-label">Total Jobs</span>
              </div>
              <div className="user-stat-item">
                <span className="stat-number">8</span>
                <span className="stat-label">Completed</span>
              </div>
              <div className="user-stat-item">
                <span className="stat-number">3</span>
                <span className="stat-label">Processing</span>
              </div>
            </div>
            <div className="user-actions">
              <button className="profile-btn">Edit Profile</button>
              <button className="settings-btn">Settings</button>
            </div>
          </div>
        </div>

        {/* Full-Screen Image Viewer Modal */}
        {fullscreenImage && (
          <div className="fullscreen-image-modal" onClick={closeFullscreenImage}>
            <div className="fullscreen-image-container">
              <div className="fullscreen-image-header">
                <h3>{fullscreenImage.type.replace('_', ' ').toUpperCase()} - {fullscreenImage.filename}</h3>
                <button className="close-fullscreen-btn" onClick={closeFullscreenImage}>×</button>
              </div>
              <div className="fullscreen-image-content">
                <img 
                  src={fullscreenImage.url} 
                  alt={fullscreenImage.filename}
                  className="fullscreen-image"
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=800&h=600&fit=crop';
                    e.target.alt = 'Fallback Image';
                  }}
                />
              </div>
              <div className="fullscreen-image-footer">
                <p className="image-instructions">
                  Click outside the image or press ESC to close
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobStatusPage;
