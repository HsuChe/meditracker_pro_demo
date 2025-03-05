const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { v4: uuidv4 } = require('uuid');
const monitoring = require('../middleware/monitoring');

// Import the existing createIngestedData function
const ingestedDataController = require('./ingestedDataController');
const { createIngestedData } = ingestedDataController;

// Get allowed origin from environment variable with fallback to wildcard
const getAllowedOrigin = () => process.env.FRONTEND_ORIGIN || '*';

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Middleware to handle single file upload
const uploadMiddleware = upload.single('file');

/**
 * Process CSV buffer into JSON data
 * @param {Buffer} buffer - CSV file buffer
 * @param {string} ingestionId - Unique ID for tracking progress
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} - Array of parsed CSV rows
 */
const processCSVBuffer = (buffer, ingestionId, options = {}) => {
  return new Promise((resolve, reject) => {
    const results = [];
    let rowCount = 0;
    
    // Start tracking this ingestion
    monitoring.trackIngestion(ingestionId);
    
    // Create a readable stream from buffer
    const stream = Readable.from(buffer.toString());
    
    stream
      .pipe(csv(options))
      .on('data', (data) => {
        results.push(data);
        rowCount++;
        
        // Update progress every 100 rows
        if (rowCount % 100 === 0) {
          const memoryUsage = process.memoryUsage();
          monitoring.updateProgress(ingestionId, {
            rowsProcessed: rowCount,
            memoryUsage: {
              heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
              rss: Math.round(memoryUsage.rss / 1024 / 1024)
            }
          });
        }
      })
      .on('end', () => {
        console.log(`CSV processing complete. ${rowCount} rows processed.`);
        // Update final progress
        const memoryUsage = process.memoryUsage();
        monitoring.updateProgress(ingestionId, {
          rowsProcessed: rowCount,
          memoryUsage: {
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            rss: Math.round(memoryUsage.rss / 1024 / 1024)
          },
          status: 'parsed'
        });
        resolve(results);
      })
      .on('error', (error) => {
        console.error('Error processing CSV:', error);
        monitoring.updateProgress(ingestionId, {
          error: error.message,
          status: 'error'
        });
        reject(error);
      });
  });
};

/**
 * Handle file upload and process CSV
 */
const handleFileUpload = async (req, res) => {
  try {
    console.log('File upload request received:', {
      body: Object.keys(req.body),
      file: req.file ? req.file.originalname : 'No file'
    });
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get file details
    const file = req.file;
    const fileSize = file.size;
    const fileName = req.body.name || file.originalname || 'unnamed_file.csv';
    
    // Generate a unique ID for this ingestion
    const ingestionId = uuidv4();
    
    // Start tracking this ingestion
    monitoring.trackIngestion(ingestionId, {
      fileName,
      totalRows: -1, // Unknown until processed
      fileSize
    });
    
    console.log(`Starting file upload process for ${fileName}, size: ${fileSize} bytes, ID: ${ingestionId}`);
    
    // Immediately return a success response with the ingestion ID
    // This way the client can start monitoring progress right away
    res.status(201).json({
      message: 'File upload started successfully',
      ingestion_id: ingestionId,
      fileName,
      fileSize,
      totalRows: 'calculating...',
      status: 'processing'
    });
    
    // Process the CSV in the background after response is sent
    try {
      const data = await processCSVBuffer(file.buffer, ingestionId);
      console.log(`CSV processing complete, ${data.length} rows processed`);
      
      // Create a mock request for createIngestedData
      const ingestRequest = {
        body: {
          name: fileName,
          data: data,
          mapping_id: req.body.mapping_id || null,
          record_count: data.length,
          file_size_bytes: fileSize,
          batch_number: 1,
          total_batches: 1,
          parent_ingestion_id: null
        }
      };
      
      // Create a mock response to capture what createIngestedData returns
      const ingestResponse = {
        status: (code) => ({
          json: (data) => {
            monitoring.completeIngestion(ingestionId, {
              status: 'completed',
              result: data
            });
            console.log(`Ingestion completed for ${fileName}, processed ${data.records_processed || data.length || 'unknown'} records`);
          }
        })
      };
      
      // Call the existing createIngestedData function
      await createIngestedData(ingestRequest, ingestResponse);
      
    } catch (error) {
      console.error('Error processing CSV or ingesting data:', error);
      monitoring.updateProgress(ingestionId, {
        error: error.message,
        status: 'error'
      });
    }
      
  } catch (error) {
    console.error('File upload error:', error);
    return res.status(500).json({ 
      error: 'File upload failed',
      details: error.message
    });
  }
};

/**
 * Handle SSE for progress updates
 */
const handleProgressStream = (req, res) => {
  const { ingestion_id } = req.query;
  
  try {
    // Always add CORS headers for SSE
    res.setHeader('Access-Control-Allow-Origin', getAllowedOrigin());
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Transfer-Encoding');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': getAllowedOrigin()
    });
    
    // Send an initial message
    const initialMessage = { type: 'connected', timestamp: Date.now() };
    res.write(`data: ${JSON.stringify(initialMessage)}\n\n`);
    
    // Default response for no ingestions
    const noIngestionsMessage = JSON.stringify({ 
      type: 'progress', 
      status: 'no_active_ingestions',
      timestamp: Date.now()
    });
    
    // Find the latest ingestion if no specific ID requested
    let targetId = ingestion_id;
    if (!targetId) {
      const allIngestions = monitoring.getAllIngestions();
      // Get the most recent active ingestion
      const latestIngestion = allIngestions
        .filter(ing => ing.status === 'processing')
        .sort((a, b) => b.startTime - a.startTime)[0];
        
      if (latestIngestion) {
        console.log(`No ingestion_id provided, using latest: ${latestIngestion.id}`);
        targetId = latestIngestion.id;
        const progressData = monitoring.getProgress(latestIngestion.id);
        res.write(`data: ${JSON.stringify(progressData)}\n\n`);
      } else {
        // No active ingestions found
        res.write(`data: ${noIngestionsMessage}\n\n`);
        
        // For testing, we'll end the connection after sending the initial response
        // to prevent continuous polling when there's no data
        setTimeout(() => {
          res.end();
        }, 100);
        return;
      }
    } else {
      // If we have a specific ID, send its progress immediately
      const initialProgress = monitoring.getProgress(targetId);
      res.write(`data: ${JSON.stringify(initialProgress)}\n\n`);
    }
    
    const progressInterval = setInterval(() => {
      try {
        let currentId = targetId;
        
        // If no specific ID was requested, keep checking for the latest
        if (!ingestion_id) {
          const latestIngestion = monitoring.getAllIngestions()
            .filter(ing => ing.status === 'processing')
            .sort((a, b) => b.startTime - a.startTime)[0];
          
          currentId = latestIngestion?.id;
        }
        
        if (!currentId) {
          res.write(`data: ${noIngestionsMessage}\n\n`);
          clearInterval(progressInterval);
          setTimeout(() => res.end(), 100);
          return;
        }
        
        const progress = monitoring.getProgress(currentId);
        
        // Send the progress update
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
        
        // If process is completed or errored, end the connection
        if (progress.status === 'completed' || progress.status === 'error') {
          clearInterval(progressInterval);
          
          // Send a final event for completion/error
          if (progress.status === 'completed') {
            const completeData = {
              type: 'complete',
              id: currentId,
              result: progress.result || {},
              message: 'Processing completed successfully',
              timestamp: Date.now()
            };
            res.write(`data: ${JSON.stringify(completeData)}\n\n`);
          } else {
            const errorData = {
              type: 'error',
              id: currentId,
              error: progress.errors || 'Unknown error occurred',
              timestamp: Date.now()
            };
            res.write(`data: ${JSON.stringify(errorData)}\n\n`);
          }
          
          // End the connection after sending final event
          setTimeout(() => res.end(), 100);
        }
      } catch (error) {
        console.error('Error in SSE progress stream:', error);
        const errorMsg = {
          type: 'error',
          message: error.message || 'An unknown error occurred',
          stack: error.stack,
          timestamp: Date.now()
        };
        res.write(`data: ${JSON.stringify(errorMsg)}\n\n`);
        clearInterval(progressInterval);
        setTimeout(() => res.end(), 100);
      }
    }, 1000); // Send updates every second
    
    // Handle client disconnect
    req.on('close', () => {
      clearInterval(progressInterval);
      console.log('Client disconnected from progress stream');
    });
  } catch (error) {
    // If we can't even start the SSE connection, respond with a regular error
    console.error('Failed to establish SSE connection:', error);
    
    // Try to send a regular error response
    try {
      // Add CORS headers even for error responses
      res.setHeader('Access-Control-Allow-Origin', getAllowedOrigin());
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      res.status(500).json({
        error: 'Failed to establish SSE connection',
        message: error.message || 'An unknown error occurred',
        stack: error.stack
      });
    } catch (responseError) {
      console.error('Could not send error response:', responseError);
      // Last resort - just end the response
      res.end();
    }
  }
};

/**
 * Simple test process endpoint for testing
 */
const handleTestProcess = (req, res) => {
  res.status(200).json({
    message: 'Test process endpoint is working',
    method: req.method,
    query: req.query,
    body: req.body
  });
};

module.exports = {
  uploadMiddleware,
  handleFileUpload,
  handleProgressStream,
  handleTestProcess
}; 