import { create } from 'zustand'
import { ClaimData, TableMetadata } from '../types'

const INITIAL_BATCH_SIZE = 1000;  // Initial quick load
const SUBSEQUENT_BATCH_SIZE = 5000;  // Size of each subsequent batch
const BATCH_INTERVAL = 100;  // Time between batch loads in ms

interface ClaimsStore {
    allClaims: ClaimData[];
    metadata: TableMetadata | null;
    currentPage: number;
    pageSize: number;
    isLoading: boolean;
    isProgressiveLoading: boolean;
    loadedCount: number;
    setAllClaims: (claims: ClaimData[]) => void;
    setMetadata: (metadata: TableMetadata) => void;
    setCurrentPage: (page: number) => void;
    setPageSize: (size: number) => void;
    setIsLoading: (loading: boolean) => void;
    getCurrentPageData: () => ClaimData[];
    fetchAllClaims: () => Promise<void>;
    appendClaims: (claims: ClaimData[]) => void;
}

export const useClaimsStore = create<ClaimsStore>((set, get) => ({
    allClaims: [],
    metadata: null,
    currentPage: 1,
    pageSize: 10,
    isLoading: false,
    isProgressiveLoading: false,
    loadedCount: 0,

    setAllClaims: (claims) => set({ allClaims: claims }),
    appendClaims: (claims) => set(state => ({ 
        allClaims: [...state.allClaims, ...claims],
        loadedCount: state.loadedCount + claims.length 
    })),
    setMetadata: (metadata) => set({ metadata }),
    setCurrentPage: (page) => set({ currentPage: page }),
    setPageSize: (size) => set({ pageSize: size }),
    setIsLoading: (loading) => set({ isLoading: loading }),

    getCurrentPageData: () => {
        const { allClaims, currentPage, pageSize } = get();
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        return allClaims.slice(start, end);
    },

    fetchAllClaims: async () => {
        const { setIsLoading, setAllClaims, setMetadata, appendClaims } = get();
        setIsLoading(true);
        set({ isProgressiveLoading: true, loadedCount: 0 });

        try {
            // Get metadata first for total count
            const metadataResponse = await fetch('http://localhost:5000/api/claims/metadata');
            const metadataStats = await metadataResponse.json();

            // Initial quick load
            const initialResponse = await fetch(`http://localhost:5000/api/claims?limit=${INITIAL_BATCH_SIZE}`);
            if (!initialResponse.ok) {
                throw new Error(`HTTP error! status: ${initialResponse.status}`);
            }
            const initialData = await initialResponse.json();
            
            // Set initial data
            setAllClaims(initialData);
            setMetadata({
                ...metadataStats,
                currentPage: 1,
                pageSize: get().pageSize,
                totalRecords: metadataStats.totalRecords,
                totalPages: Math.ceil(metadataStats.totalRecords / get().pageSize),
                columns: initialData.length > 0 ? Object.keys(initialData[0]) : [],
                dateRange: { start: '', end: '' }
            });

            // Progressive loading
            let offset = INITIAL_BATCH_SIZE;
            const loadNextBatch = async () => {
                if (offset >= metadataStats.totalRecords || offset >= 50000) {
                    set({ isProgressiveLoading: false });
                    return;
                }

                try {
                    const response = await fetch(
                        `http://localhost:5000/api/claims?limit=${SUBSEQUENT_BATCH_SIZE}&offset=${offset}`
                    );
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    
                    const data = await response.json();
                    appendClaims(data);
                    offset += data.length;

                    // Schedule next batch
                    if (offset < metadataStats.totalRecords && offset < 50000) {
                        setTimeout(loadNextBatch, BATCH_INTERVAL);
                    } else {
                        set({ isProgressiveLoading: false });
                    }
                } catch (error) {
                    console.error('Error loading batch:', error);
                    set({ isProgressiveLoading: false });
                }
            };

            // Start progressive loading after initial load
            setTimeout(loadNextBatch, BATCH_INTERVAL);

        } catch (error) {
            console.error('Error fetching claims:', error);
            set({ isProgressiveLoading: false });
        } finally {
            setIsLoading(false);
        }
    }
})); 