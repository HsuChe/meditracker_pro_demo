import { Card, CardContent } from "@/components/ui/card"
import { TableMetadata } from "../types"

interface MetadataDisplayProps {
    metadata: TableMetadata;
}

export function MetadataDisplay({ metadata }: MetadataDisplayProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
                <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Total Records</div>
                    <div className="text-2xl font-bold">
                        {(metadata.totalRecords || 0).toLocaleString()}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Total Amount</div>
                    <div className="text-2xl font-bold">
                        ${(metadata.totalAmount || 0).toLocaleString(undefined, { 
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2 
                        })}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Average Amount</div>
                    <div className="text-2xl font-bold">
                        ${(metadata.averageAmount || 0).toLocaleString(undefined, { 
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2 
                        })}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Unique Patients</div>
                    <div className="text-2xl font-bold">
                        {(metadata.uniquePatients || 0).toLocaleString()}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
} 