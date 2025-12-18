import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
// @ts-ignore
import { saveAs } from 'file-saver'

// Export interfaces for type safety
export interface ExportColumn {
  header: string
  dataKey: string
  width?: number
  formatter?: (value: any, item?: any) => string
}

export interface ExportData {
  title: string
  subtitle?: string
  data: any[]
  columns: ExportColumn[]
  filename: string
  summary?: ExportSummary
}

export interface ExportSummary {
  totalRecords: number
  additionalStats?: { label: string; value: string | number }[]
}

// BCI Corporate Colors and Styling
const BCI_COLORS = {
  primary: '#2563eb', // Blue
  primaryDark: '#1d4ed8',
  secondary: '#64748b', // Slate
  accent: '#059669', // Green
  text: '#1e293b',
  lightGray: '#f8fafc',
  mediumGray: '#e2e8f0',
  darkGray: '#475569'
}

// PDF Export Utilities
export class PDFExporter {
  private doc: jsPDF

  constructor() {
    this.doc = new jsPDF('landscape', 'mm', 'a4')
  }

  private addBCIHeader(title: string, subtitle?: string) {
    const pageWidth = this.doc.internal.pageSize.getWidth()
    
    // Add BCI Logo area (text-based since we can't easily embed images)
    this.doc.setFillColor(BCI_COLORS.primary)
    this.doc.rect(20, 10, 60, 25, 'F')
    
    // BCI Logo Text
    this.doc.setTextColor(255, 255, 255)
    this.doc.setFontSize(24)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('BCI', 50, 25, { align: 'center' })
    
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text('Parking Management', 50, 30, { align: 'center' })
    
    // Report Title
    this.doc.setTextColor(BCI_COLORS.text)
    this.doc.setFontSize(20)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text(title, 90, 25)
    
    // Subtitle if provided
    if (subtitle) {
      this.doc.setFontSize(12)
      this.doc.setFont('helvetica', 'normal')
      this.doc.setTextColor(BCI_COLORS.secondary)
      this.doc.text(subtitle, 90, 32)
    }
    
    // Date and time
    const now = new Date()
    const dateStr = now.toLocaleDateString()
    const timeStr = now.toLocaleTimeString()
    
    this.doc.setFontSize(10)
    this.doc.setTextColor(BCI_COLORS.secondary)
    this.doc.text(`Generated: ${dateStr} at ${timeStr}`, pageWidth - 20, 20, { align: 'right' })
    
    // Separator line
    this.doc.setDrawColor(BCI_COLORS.mediumGray)
    this.doc.setLineWidth(0.5)
    this.doc.line(20, 40, pageWidth - 20, 40)
  }

  private addBCIFooter() {
    const pageHeight = this.doc.internal.pageSize.getHeight()
    const pageWidth = this.doc.internal.pageSize.getWidth()
    const currentPage = this.doc.getCurrentPageInfo().pageNumber
    const pageCount = this.doc.getNumberOfPages()
    
    // Footer line
    this.doc.setDrawColor(BCI_COLORS.mediumGray)
    this.doc.setLineWidth(0.5)
    this.doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20)
    
    // Footer text
    this.doc.setFontSize(8)
    this.doc.setTextColor(BCI_COLORS.secondary)
    this.doc.text('BCI ParkShare - Confidential Report', 20, pageHeight - 15)
    
    // Page number - only draw on current page
    this.doc.text(
      `Page ${currentPage} of ${pageCount}`,
      pageWidth - 20,
      pageHeight - 15,
      { align: 'right' }
    )
  }

  private addSummarySection(summary: ExportSummary) {
    const startY = 50
    
    // Summary header
    this.doc.setFontSize(14)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setTextColor(BCI_COLORS.primary)
    this.doc.text('Report Summary', 20, startY)
    
    // Total records
    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    this.doc.setTextColor(BCI_COLORS.text)
    this.doc.text(`Total Records: ${summary.totalRecords}`, 20, startY + 8)
    
    // Additional stats
    let yOffset = startY + 16
    if (summary.additionalStats) {
      summary.additionalStats.forEach((stat) => {
        this.doc.text(`${stat.label}: ${stat.value}`, 20, yOffset)
        yOffset += 6
      })
    }
    
    return yOffset + 10 // Return next available Y position
  }

  exportToPDF(exportData: ExportData): void {
    this.addBCIHeader(exportData.title, exportData.subtitle)
    
    let startY = 50
    
    // Add summary if provided
    if (exportData.summary) {
      startY = this.addSummarySection(exportData.summary)
    }
    
    // Prepare table data
    const tableColumns = exportData.columns.map(col => ({
      header: col.header,
      dataKey: col.dataKey
    }))
    
    const tableRows = exportData.data.map(row => {
      const formattedRow: any = {}
      exportData.columns.forEach(col => {
        const value = row[col.dataKey]
        let formattedValue = value
        
        if (col.formatter) {
          try {
            formattedValue = col.formatter(value, row)
          } catch (error) {
            console.error('Formatter error:', error)
            formattedValue = value
          }
        }
        
        // Ensure value is a string and handle objects/null/undefined
        if (formattedValue === null || formattedValue === undefined) {
          formattedRow[col.dataKey] = '-'
        } else if (typeof formattedValue === 'object') {
          formattedRow[col.dataKey] = formattedValue instanceof Date 
            ? formattedValue.toLocaleDateString() 
            : JSON.stringify(formattedValue)
        } else {
          formattedRow[col.dataKey] = String(formattedValue)
        }
      })
      return formattedRow
    })
    
    // Generate table with BCI styling
    autoTable(this.doc, {
      startY: startY,
      head: [tableColumns.map(col => col.header)],
      body: tableRows.map(row => tableColumns.map(col => row[col.dataKey])),
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: BCI_COLORS.text,
        lineColor: BCI_COLORS.mediumGray,
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: BCI_COLORS.primary,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: BCI_COLORS.lightGray
      },
      columnStyles: exportData.columns.reduce((styles, col, index) => {
        if (col.width) {
          styles[index] = { cellWidth: col.width }
        }
        return styles
      }, {} as any),
      margin: { top: 20, right: 20, bottom: 30, left: 20 },
      didDrawPage: () => {
        this.addBCIFooter()
      }
    })
    
    // Save the PDF
    this.doc.save(`${exportData.filename}.pdf`)
  }
}

// Excel Export Utilities
export class ExcelExporter {
  private createStyledWorkbook(exportData: ExportData): XLSX.WorkBook {
    const wb = XLSX.utils.book_new()
    
    // Create worksheet data with proper headers
    const wsData: any[][] = []
    
    // Add title rows
    wsData.push(['BCI ParkShare'])
    wsData.push([exportData.title])
    if (exportData.subtitle) {
      wsData.push([exportData.subtitle])
    }
    wsData.push([`Generated: ${new Date().toLocaleString()}`])
    wsData.push([]) // Empty row
    
    // Add summary if provided
    if (exportData.summary) {
      wsData.push(['REPORT SUMMARY'])
      wsData.push([`Total Records: ${exportData.summary.totalRecords}`])
      if (exportData.summary.additionalStats) {
        exportData.summary.additionalStats.forEach(stat => {
          wsData.push([`${stat.label}: ${stat.value}`])
        })
      }
      wsData.push([]) // Empty row
    }
    
    // Add column headers
    wsData.push(exportData.columns.map(col => col.header))
    
    // Add data rows
    exportData.data.forEach(row => {
      const formattedRow = exportData.columns.map(col => {
        const value = row[col.dataKey]
        let formattedValue = value
        
        if (col.formatter) {
          try {
            formattedValue = col.formatter(value, row)
          } catch (error) {
            console.error('Formatter error:', error)
            formattedValue = value
          }
        }
        
        // Ensure value is a string and handle objects/null/undefined
        if (formattedValue === null || formattedValue === undefined) {
          return '-'
        } else if (typeof formattedValue === 'object') {
          return formattedValue instanceof Date 
            ? formattedValue.toLocaleDateString() 
            : JSON.stringify(formattedValue)
        } else {
          return String(formattedValue)
        }
      })
      wsData.push(formattedRow)
    })
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    
    // Apply basic styling (Excel styling is limited in XLSX library)
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    
    // Set column widths
    ws['!cols'] = exportData.columns.map(col => ({
      wch: col.width || 15
    }))
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Report Data')
    
    return wb
  }

  exportToExcel(exportData: ExportData): void {
    const wb = this.createStyledWorkbook(exportData)
    
    // Generate Excel file and save
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `${exportData.filename}.xlsx`)
  }
}

// Convenience functions for common export scenarios
export const exportBookingsData = (bookings: any[], title: string = 'Booking Report', scope?: string) => {
  const columns: ExportColumn[] = [
    { header: 'Booking ID', dataKey: 'id', width: 15 },
    { header: 'Spot Number', dataKey: 'spotNumber', width: 12 },
    { header: 'Spot Location', dataKey: 'spotLocation', width: 20 },
    { header: 'Renter Name', dataKey: 'renterName', width: 18 },
    { header: 'Renter Email', dataKey: 'renterEmail', width: 25 },
    { header: 'Owner Name', dataKey: 'ownerName', width: 18 },
    { header: 'Status', dataKey: 'status', width: 12, formatter: (status) => status?.toUpperCase() || '-' },
    { header: 'Daily Rate', dataKey: 'dailyRate', width: 12, formatter: (rate) => `$${rate || 0}` },
    { header: 'Start Time', dataKey: 'startTime', width: 15, formatter: (time) => time ? new Date(time).toLocaleTimeString() : '-' },
    { header: 'End Time', dataKey: 'endTime', width: 15, formatter: (time) => time ? new Date(time).toLocaleTimeString() : '-' },
    { header: 'Booking Date', dataKey: 'bookingDate', width: 15, formatter: (date) => date ? new Date(date).toLocaleDateString() : '-' },
    { header: 'Payment Status', dataKey: 'paymentReceived', width: 15, formatter: (received) => received ? 'Received' : 'Pending' }
  ]

  const scopeSuffix = scope === 'bci' ? '-bci-managed' : scope === 'all' ? '-all' : ''
  const filename = `bookings-report${scopeSuffix}-${new Date().toISOString().split('T')[0]}`

  const exportData: ExportData = {
    title,
    subtitle: scope === 'bci' ? 'BCI-Managed Bookings Report' : 'Active Bookings Management Report',
    data: bookings,
    columns,
    filename,
    summary: {
      totalRecords: bookings.length,
      additionalStats: [
        { label: 'Confirmed Bookings', value: bookings.filter(b => b.status === 'confirmed').length },
        { label: 'Pending Bookings', value: bookings.filter(b => b.status === 'pending').length },
        { label: 'Total Revenue', value: `$${bookings.reduce((sum, b) => sum + (b.dailyRate || 0), 0)}` }
      ]
    }
  }

  return exportData
}

export const exportUsersData = (users: any[], title: string = 'User Management Report') => {
  const columns: ExportColumn[] = [
    { header: 'User ID', dataKey: 'id', width: 15 },
    { header: 'Name', dataKey: 'name', width: 20 },
    { header: 'Email', dataKey: 'email', width: 30 },
    { header: 'Department', dataKey: 'department', width: 18 },
    { header: 'Role', dataKey: 'role', width: 12, formatter: (role) => role?.toUpperCase() || '-' },
    { header: 'Phone Number', dataKey: 'phoneNumber', width: 18 },
    { header: 'Status', dataKey: 'status', width: 12, formatter: (status) => status?.toUpperCase() || 'ACTIVE' },
    { header: 'Spots Owned', dataKey: 'spotsOwned', width: 12 },
    { header: 'As Renter', dataKey: 'renterBookingsCount', width: 12 },
    { header: 'As Owner', dataKey: 'ownerBookingsCount', width: 12 },
    { header: 'Last Login', dataKey: 'lastLogin', width: 15 },
    { header: 'Member Since', dataKey: 'memberSince', width: 15 }
  ]

  const exportData: ExportData = {
    title,
    subtitle: 'User Management and Analytics Report',
    data: users,
    columns,
    filename: `users-report-${new Date().toISOString().split('T')[0]}`,
    summary: {
      totalRecords: users.length,
      additionalStats: [
        { label: 'Active Users', value: users.filter(u => u.status !== 'suspended').length },
        { label: 'Admin Users', value: users.filter(u => u.role === 'admin').length },
        { label: 'Owner Users', value: users.filter(u => u.role === 'owner').length },
        { label: 'Renter Users', value: users.filter(u => u.role === 'renter').length },
        { label: 'Total Spots Owned', value: users.reduce((sum, u) => sum + (u.spotsOwned || 0), 0) },
        { label: 'Bookings (As Renter)', value: users.reduce((sum, u) => sum + (u.renterBookingsCount || 0), 0) },
        { label: 'Bookings (As Owner)', value: users.reduce((sum, u) => sum + (u.ownerBookingsCount || 0), 0) }
      ]
    }
  }

  return exportData
}

export const exportParkingSpotsData = (spots: any[], title: string = 'Parking Management Report') => {
  // Helper to determine status based on assignment
  const getStatus = (spot: any) => {
    return spot.ownerId ? 'OCCUPIED' : 'AVAILABLE'
  }
  
  const columns: ExportColumn[] = [
    { header: 'Spot ID', dataKey: 'id', width: 15 },
    { header: 'Spot Number', dataKey: 'spotNumber', width: 12 },
    { header: 'Location ID', dataKey: 'locationId', width: 12 },
    { header: 'Location Name', dataKey: 'locationName', width: 30 },
    { header: 'Spot Type ID', dataKey: 'spotTypeId', width: 12 },
    { header: 'Spot Type', dataKey: 'spotTypeName', width: 15, formatter: (type) => type?.toUpperCase() || 'REGULAR' },
    { header: 'Status', dataKey: 'id', width: 12, formatter: (_, spot) => getStatus(spot) },
    { header: 'BCI Managed', dataKey: 'isBciManaged', width: 12, formatter: (managed) => managed ? 'Yes' : 'No' },
    { header: 'Owner ID', dataKey: 'ownerId', width: 15 },
    { header: 'Assigned User', dataKey: 'assignedUserName', width: 20 },
    { header: 'Assigned Email', dataKey: 'assignedUserEmail', width: 25 },
    { header: 'Department', dataKey: 'assignedUserDepartment', width: 20 },
    { header: 'Indoor', dataKey: 'isIndoor', width: 10, formatter: (indoor) => indoor ? 'Yes' : 'No' },
    { header: 'Active', dataKey: 'isActive', width: 10, formatter: (active) => active ? 'Yes' : 'No' },
    { header: 'Bookable', dataKey: 'isBookable', width: 12, formatter: (bookable) => bookable ? 'Yes' : 'No' },
    { header: 'Description', dataKey: 'description', width: 30 },
    { header: 'Created At', dataKey: 'createdAt', width: 18, formatter: (date) => date ? new Date(date).toLocaleString() : 'N/A' }
  ]

  const exportData: ExportData = {
    title,
    subtitle: 'Parking Spot Management and Allocation Report',
    data: spots,
    columns,
    filename: `parking-spots-report-${new Date().toISOString().split('T')[0]}`,
    summary: {
      totalRecords: spots.length,
      additionalStats: [
        { label: 'Available Spots', value: spots.filter(s => !s.ownerId).length },
        { label: 'Occupied Spots', value: spots.filter(s => s.ownerId).length },
        { label: 'Indoor Spots', value: spots.filter(s => s.isIndoor).length },
        { label: 'Bookable Spots', value: spots.filter(s => s.isBookable).length },
        { label: 'BCI Managed', value: spots.filter(s => s.isBciManaged).length },
        { label: 'Premium Spots', value: spots.filter(s => s.spotTypeName?.toLowerCase() === 'premium').length }
      ]
    }
  }

  return exportData
}

// Main export functions
export const exportToPDF = (exportData: ExportData) => {
  const pdfExporter = new PDFExporter()
  pdfExporter.exportToPDF(exportData)
}

export const exportToExcel = (exportData: ExportData) => {
  const excelExporter = new ExcelExporter()
  excelExporter.exportToExcel(exportData)
}

// Quick export functions for admin pages with error handling and empty data guards
export const quickExportBookingsPDF = (bookings: any[], title?: string, onError?: (message: string) => void, scope?: string) => {
  try {
    if (!bookings || bookings.length === 0) {
      const message = 'No booking data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportBookingsData(bookings, title, scope)
    exportToPDF(exportData)
    return true
  } catch (error) {
    console.error('Error exporting bookings to PDF:', error)
    const message = error instanceof Error ? error.message : 'Failed to export bookings to PDF'
    if (onError) onError(message)
    return false
  }
}

export const quickExportBookingsExcel = (bookings: any[], title?: string, onError?: (message: string) => void, scope?: string) => {
  try {
    if (!bookings || bookings.length === 0) {
      const message = 'No booking data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportBookingsData(bookings, title, scope)
    exportToExcel(exportData)
    return true
  } catch (error) {
    console.error('Error exporting bookings to Excel:', error)
    const message = error instanceof Error ? error.message : 'Failed to export bookings to Excel'
    if (onError) onError(message)
    return false
  }
}

export const quickExportUsersPDF = (users: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!users || users.length === 0) {
      const message = 'No user data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportUsersData(users, title)
    exportToPDF(exportData)
    return true
  } catch (error) {
    console.error('Error exporting users to PDF:', error)
    const message = error instanceof Error ? error.message : 'Failed to export users to PDF'
    if (onError) onError(message)
    return false
  }
}

export const quickExportUsersExcel = (users: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!users || users.length === 0) {
      const message = 'No user data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportUsersData(users, title)
    exportToExcel(exportData)
    return true
  } catch (error) {
    console.error('Error exporting users to Excel:', error)
    const message = error instanceof Error ? error.message : 'Failed to export users to Excel'
    if (onError) onError(message)
    return false
  }
}

export const quickExportParkingSpotsPDF = (spots: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!spots || spots.length === 0) {
      const message = 'No parking spot data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportParkingSpotsData(spots, title)
    exportToPDF(exportData)
    return true
  } catch (error) {
    console.error('Error exporting parking spots to PDF:', error)
    const message = error instanceof Error ? error.message : 'Failed to export parking spots to PDF'
    if (onError) onError(message)
    return false
  }
}

export const quickExportParkingSpotsExcel = (spots: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!spots || spots.length === 0) {
      const message = 'No parking spot data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportParkingSpotsData(spots, title)
    exportToExcel(exportData)
    return true
  } catch (error) {
    console.error('Error exporting parking spots to Excel:', error)
    const message = error instanceof Error ? error.message : 'Failed to export parking spots to Excel'
    if (onError) onError(message)
    return false
  }
}

export const exportWaitingListData = (waitingList: any[], title: string = 'Waiting List Report') => {
  const columns: ExportColumn[] = [
    { header: 'ID', dataKey: 'id', width: 15 },
    { header: 'User Name', dataKey: 'userName', width: 20 },
    { header: 'User Email', dataKey: 'userEmail', width: 30 },
    { header: 'Priority', dataKey: 'priority', width: 12, formatter: (priority) => {
      if (priority === 1) return 'HIGH'
      if (priority === 2) return 'MEDIUM'
      if (priority === 3) return 'LOW'
      return 'MEDIUM'
    }},
    { header: 'Preferred Spot Type', dataKey: 'preferredSpotType', width: 20, formatter: (type) => type?.toUpperCase() || 'ANY' },
    { header: 'Status', dataKey: 'status', width: 12, formatter: (status) => status?.toUpperCase() || 'ACTIVE' },
    { header: 'Enrolled Date', dataKey: 'enrolledDate', width: 15, formatter: (date) => new Date(date).toLocaleDateString() },
    { header: 'Waiting Days', dataKey: 'waitingDays', width: 12, formatter: (value: any, item: any) => {
      const waitingDays = Math.floor((Date.now() - new Date(item.enrolledDate).getTime()) / (1000 * 60 * 60 * 24));
      return waitingDays.toString();
    }},
    { header: 'Reason', dataKey: 'reason', width: 40 }
  ]

  const exportData: ExportData = {
    title,
    subtitle: 'Parking Waiting List Management Report',
    data: waitingList,
    columns,
    filename: `waiting-list-report-${new Date().toISOString().split('T')[0]}`,
    summary: {
      totalRecords: waitingList.length,
      additionalStats: [
        { label: 'Active Requests', value: waitingList.filter(w => w.status === 'active').length },
        { label: 'High Priority', value: waitingList.filter(w => w.priority === 1).length },
        { label: 'Medium Priority', value: waitingList.filter(w => w.priority === 2).length },
        { label: 'Low Priority', value: waitingList.filter(w => w.priority === 3).length },
        { label: 'Average Wait Days', value: Math.round(waitingList.reduce((sum, w) => {
          const waitingDays = Math.floor((Date.now() - new Date(w.enrolledDate).getTime()) / (1000 * 60 * 60 * 24));
          return sum + waitingDays;
        }, 0) / waitingList.length) || 0 }
      ]
    }
  }

  return exportData
}

export const quickExportWaitingListPDF = (waitingList: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!waitingList || waitingList.length === 0) {
      const message = 'No waiting list data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportWaitingListData(waitingList, title)
    exportToPDF(exportData)
    return true
  } catch (error) {
    console.error('Error exporting waiting list to PDF:', error)
    const message = error instanceof Error ? error.message : 'Failed to export waiting list to PDF'
    if (onError) onError(message)
    return false
  }
}

export const quickExportWaitingListExcel = (waitingList: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!waitingList || waitingList.length === 0) {
      const message = 'No waiting list data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportWaitingListData(waitingList, title)
    exportToExcel(exportData)
    return true
  } catch (error) {
    console.error('Error exporting waiting list to Excel:', error)
    const message = error instanceof Error ? error.message : 'Failed to export waiting list to Excel'
    if (onError) onError(message)
    return false
  }
}

// Export functions for booking requests
export const exportBookingRequestsData = (requests: any[], title: string = 'Booking Requests Report') => {
  const columns: ExportColumn[] = [
    { header: 'ID', dataKey: 'id', width: 15 },
    { header: 'Request Type', dataKey: 'type', width: 15, formatter: (type) => type?.toUpperCase() || 'UNKNOWN' },
    { header: 'Submitted By', dataKey: 'submittedBy', width: 25 },
    { header: 'Email', dataKey: 'email', width: 30 },
    { header: 'Spot Number', dataKey: 'spotNumber', width: 15 },
    { header: 'Urgency', dataKey: 'urgency', width: 12, formatter: (urgency) => urgency?.toUpperCase() || 'MEDIUM' },
    { header: 'Status', dataKey: 'status', width: 12, formatter: (status) => status?.toUpperCase() || 'PENDING' },
    { header: 'Request Date', dataKey: 'requestDate', width: 15, formatter: (date) => new Date(date).toLocaleDateString() },
    { header: 'Reason', dataKey: 'reason', width: 50 }
  ]

  const exportData: ExportData = {
    title,
    subtitle: 'Booking Request Management Report',
    data: requests,
    columns,
    filename: `booking-requests-report-${new Date().toISOString().split('T')[0]}`,
    summary: {
      totalRecords: requests.length,
      additionalStats: [
        { label: 'Pending Requests', value: requests.filter(r => r.status === 'pending').length },
        { label: 'Resolved Requests', value: requests.filter(r => r.status === 'resolved').length },
        { label: 'High Urgency', value: requests.filter(r => r.urgency === 'high').length },
        { label: 'Cancellation Requests', value: requests.filter(r => r.type === 'cancellation').length },
        { label: 'Dispute Requests', value: requests.filter(r => r.type === 'dispute').length },
        { label: 'Modification Requests', value: requests.filter(r => r.type === 'modification').length }
      ]
    }
  }

  return exportData
}

export const quickExportBookingRequestsPDF = (requests: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!requests || requests.length === 0) {
      const message = 'No booking requests data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportBookingRequestsData(requests, title)
    exportToPDF(exportData)
    return true
  } catch (error) {
    console.error('Error exporting booking requests to PDF:', error)
    const message = error instanceof Error ? error.message : 'Failed to export booking requests to PDF'
    if (onError) onError(message)
    return false
  }
}

export const quickExportBookingRequestsExcel = (requests: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!requests || requests.length === 0) {
      const message = 'No booking requests data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportBookingRequestsData(requests, title)
    exportToExcel(exportData)
    return true
  } catch (error) {
    console.error('Error exporting booking requests to Excel:', error)
    const message = error instanceof Error ? error.message : 'Failed to export booking requests to Excel'
    if (onError) onError(message)
    return false
  }
}

// Export functions for booking activity
export const exportBookingActivityData = (activities: any[], title: string = 'Booking Activity Report', scope?: string) => {
  const columns: ExportColumn[] = [
    { header: 'ID', dataKey: 'id', width: 15 },
    { header: 'Activity Type', dataKey: 'type', width: 20, formatter: (type) => {
      switch (type) {
        case 'booking_created': return 'Booking Created'
        case 'booking_cancelled': return 'Booking Cancelled'
        case 'booking_completed': return 'Booking Completed'
        case 'payment_received': return 'Payment Received'
        case 'payment_updated': return 'Payment Updated'
        case 'spot_assigned': return 'Spot Assigned'
        case 'listing_created': return 'Listing Created'
        case 'listing_updated': return 'Listing Updated'
        default: return 'Unknown Activity'
      }
    }},
    { header: 'Actor', dataKey: 'actorName', width: 25 },
    { header: 'Description', dataKey: 'description', width: 40 },
    { header: 'Result', dataKey: 'success', width: 12, formatter: (success) => success ? 'SUCCESS' : 'FAILURE' },
    { header: 'Timestamp', dataKey: 'timestamp', width: 20, formatter: (timestamp) => new Date(timestamp).toLocaleString() },
    { header: 'Details', dataKey: 'details', width: 50 }
  ]

  const scopeSuffix = scope === 'bci' ? '-bci-managed' : scope === 'all' ? '-all' : ''
  const filename = `booking-activity-report${scopeSuffix}-${new Date().toISOString().split('T')[0]}`

  const exportData: ExportData = {
    title,
    subtitle: scope === 'bci' ? 'BCI-Managed Booking Activity Log' : 'Booking Activity Log Report',
    data: activities,
    columns,
    filename,
    summary: {
      totalRecords: activities.length,
      additionalStats: [
        { label: 'Successful Actions', value: activities.filter(a => a.success === true).length },
        { label: 'Failed Actions', value: activities.filter(a => a.success === false).length },
        { label: 'Bookings Created', value: activities.filter(a => a.type === 'booking_created').length },
        { label: 'Bookings Cancelled', value: activities.filter(a => a.type === 'booking_cancelled').length },
        { label: 'Payments Received', value: activities.filter(a => a.type === 'payment_received').length },
        { label: 'Listings Created', value: activities.filter(a => a.type === 'listing_created').length }
      ]
    }
  }

  return exportData
}

export const quickExportBookingActivityPDF = (activities: any[], title?: string, onError?: (message: string) => void, scope?: string) => {
  try {
    if (!activities || activities.length === 0) {
      const message = 'No booking activity data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportBookingActivityData(activities, title, scope)
    exportToPDF(exportData)
    return true
  } catch (error) {
    console.error('Error exporting booking activity to PDF:', error)
    const message = error instanceof Error ? error.message : 'Failed to export booking activity to PDF'
    if (onError) onError(message)
    return false
  }
}

export const quickExportBookingActivityExcel = (activities: any[], title?: string, onError?: (message: string) => void, scope?: string) => {
  try {
    if (!activities || activities.length === 0) {
      const message = 'No booking activity data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportBookingActivityData(activities, title, scope)
    exportToExcel(exportData)
    return true
  } catch (error) {
    console.error('Error exporting booking activity to Excel:', error)
    const message = error instanceof Error ? error.message : 'Failed to export booking activity to Excel'
    if (onError) onError(message)
    return false
  }
}

// Export functions for lockers
export const exportLockersData = (lockers: any[], title: string = 'Locker Management Report') => {
  const columns: ExportColumn[] = [
    { header: 'Locker ID', dataKey: 'id', width: 15 },
    { header: 'Locker Number', dataKey: 'lockerNumber', width: 15 },
    { header: 'Location ID', dataKey: 'locationId', width: 12 },
    { header: 'Location Name', dataKey: 'locationName', width: 30 },
    { header: 'Locker Type ID', dataKey: 'lockerTypeId', width: 12 },
    { header: 'Locker Type', dataKey: 'lockerTypeName', width: 15, formatter: (type) => type?.toUpperCase() || 'STANDARD' },
    { header: 'Status', dataKey: 'status', width: 12, formatter: (status) => status?.toUpperCase() || 'AVAILABLE' },
    { header: 'BCI Managed', dataKey: 'isBciManaged', width: 12, formatter: (managed) => managed ? 'Yes' : 'No' },
    { header: 'Assigned User ID', dataKey: 'assignedTo', width: 15 },
    { header: 'Assigned User Name', dataKey: 'assignedUserName', width: 25 },
    { header: 'Assigned User Email', dataKey: 'assignedUserEmail', width: 30 },
    { header: 'Notes', dataKey: 'notes', width: 40 }
  ]

  const exportData: ExportData = {
    title,
    subtitle: 'Locker Management and Allocation Report',
    data: lockers,
    columns,
    filename: `lockers-report-${new Date().toISOString().split('T')[0]}`,
    summary: {
      totalRecords: lockers.length,
      additionalStats: [
        { label: 'Available Lockers', value: lockers.filter(l => l.status === 'available').length },
        { label: 'Assigned Lockers', value: lockers.filter(l => l.status === 'assigned').length },
        { label: 'BCI Managed', value: lockers.filter(l => l.isBciManaged).length },
        { label: 'User Managed', value: lockers.filter(l => !l.isBciManaged).length }
      ]
    }
  }

  return exportData
}

export const quickExportLockersPDF = (lockers: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!lockers || lockers.length === 0) {
      const message = 'No locker data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportLockersData(lockers, title)
    exportToPDF(exportData)
    return true
  } catch (error) {
    console.error('Error exporting lockers to PDF:', error)
    const message = error instanceof Error ? error.message : 'Failed to export lockers to PDF'
    if (onError) onError(message)
    return false
  }
}

export const quickExportLockersExcel = (lockers: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!lockers || lockers.length === 0) {
      const message = 'No locker data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportLockersData(lockers, title)
    exportToExcel(exportData)
    return true
  } catch (error) {
    console.error('Error exporting lockers to Excel:', error)
    const message = error instanceof Error ? error.message : 'Failed to export lockers to Excel'
    if (onError) onError(message)
    return false
  }
}

// Export functions for locker waitlist
export const exportLockerWaitlistData = (waitlist: any[], title: string = 'Locker Waitlist Report') => {
  const columns: ExportColumn[] = [
    { header: 'User Name', dataKey: 'userName', width: 20 },
    { header: 'User Email', dataKey: 'userEmail', width: 30 },
    { header: 'Department', dataKey: 'department', width: 20 },
    { header: 'Location', dataKey: 'location', width: 25 },
    { header: 'Requested Type', dataKey: 'requestedType', width: 15, formatter: (type) => type?.toUpperCase() || 'ANY' },
    { header: 'Priority', dataKey: 'priority', width: 12, formatter: (priority) => {
      if (priority === 1) return 'HIGH'
      if (priority === 2) return 'MEDIUM'
      if (priority === 3) return 'LOW'
      return 'MEDIUM'
    }},
    { header: 'Status', dataKey: 'status', width: 12, formatter: (status) => status?.toUpperCase() || 'ACTIVE' },
    { header: 'Request Date', dataKey: 'requestDate', width: 15, formatter: (date) => new Date(date).toLocaleDateString() },
    { header: 'Waiting Days', dataKey: 'waitingDays', width: 12, formatter: (value: any, item: any) => {
      const waitingDays = Math.floor((Date.now() - new Date(item.requestDate).getTime()) / (1000 * 60 * 60 * 24));
      return waitingDays.toString();
    }},
    { header: 'Notes', dataKey: 'notes', width: 40 }
  ]

  const exportData: ExportData = {
    title,
    subtitle: 'Locker Waitlist Management Report',
    data: waitlist,
    columns,
    filename: `locker-waitlist-report-${new Date().toISOString().split('T')[0]}`,
    summary: {
      totalRecords: waitlist.length,
      additionalStats: [
        { label: 'Active Requests', value: waitlist.filter(w => w.status === 'active').length },
        { label: 'High Priority', value: waitlist.filter(w => w.priority === 1).length },
        { label: 'Medium Priority', value: waitlist.filter(w => w.priority === 2).length },
        { label: 'Low Priority', value: waitlist.filter(w => w.priority === 3).length },
        { label: 'Average Wait Days', value: Math.round(waitlist.reduce((sum, w) => {
          const waitingDays = Math.floor((Date.now() - new Date(w.requestDate).getTime()) / (1000 * 60 * 60 * 24));
          return sum + waitingDays;
        }, 0) / waitlist.length) || 0 }
      ]
    }
  }

  return exportData
}

export const quickExportLockerWaitlistPDF = (waitlist: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!waitlist || waitlist.length === 0) {
      const message = 'No locker waitlist data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportLockerWaitlistData(waitlist, title)
    exportToPDF(exportData)
    return true
  } catch (error) {
    console.error('Error exporting locker waitlist to PDF:', error)
    const message = error instanceof Error ? error.message : 'Failed to export locker waitlist to PDF'
    if (onError) onError(message)
    return false
  }
}

export const quickExportLockerWaitlistExcel = (waitlist: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!waitlist || waitlist.length === 0) {
      const message = 'No locker waitlist data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportLockerWaitlistData(waitlist, title)
    exportToExcel(exportData)
    return true
  } catch (error) {
    console.error('Error exporting locker waitlist to Excel:', error)
    const message = error instanceof Error ? error.message : 'Failed to export locker waitlist to Excel'
    if (onError) onError(message)
    return false
  }
}

// Export functions for locker assignment history
export const exportLockerAssignmentHistoryData = (history: any[], title: string = 'Locker Assignment History Report') => {
  const columns: ExportColumn[] = [
    { header: 'Locker Number', dataKey: 'lockerNumber', width: 15 },
    { header: 'Location', dataKey: 'location', width: 25 },
    { header: 'Action', dataKey: 'action', width: 15, formatter: (action) => {
      if (action === 'assigned') return 'Assigned'
      if (action === 'unassigned') return 'Unassigned'
      return action?.toUpperCase() || 'UNKNOWN'
    }},
    { header: 'User Name', dataKey: 'userName', width: 20 },
    { header: 'User Email', dataKey: 'userEmail', width: 30 },
    { header: 'Department', dataKey: 'department', width: 20 },
    { header: 'Effective Date', dataKey: 'effectiveDate', width: 15, formatter: (date) => new Date(date).toLocaleDateString() },
    { header: 'Actor', dataKey: 'actor', width: 25 },
    { header: 'Notes', dataKey: 'notes', width: 40 }
  ]

  const exportData: ExportData = {
    title,
    subtitle: 'Locker Assignment History and Audit Report',
    data: history,
    columns,
    filename: `locker-assignment-history-report-${new Date().toISOString().split('T')[0]}`,
    summary: {
      totalRecords: history.length,
      additionalStats: [
        { label: 'Assignments', value: history.filter(h => h.action === 'assigned').length },
        { label: 'Unassignments', value: history.filter(h => h.action === 'unassigned').length },
        { label: 'Unique Lockers', value: new Set(history.map(h => h.lockerNumber)).size },
        { label: 'Unique Users', value: new Set(history.map(h => h.userEmail)).size }
      ]
    }
  }

  return exportData
}

export const quickExportLockerAssignmentHistoryPDF = (history: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!history || history.length === 0) {
      const message = 'No locker assignment history data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportLockerAssignmentHistoryData(history, title)
    exportToPDF(exportData)
    return true
  } catch (error) {
    console.error('Error exporting locker assignment history to PDF:', error)
    const message = error instanceof Error ? error.message : 'Failed to export locker assignment history to PDF'
    if (onError) onError(message)
    return false
  }
}

export const quickExportLockerAssignmentHistoryExcel = (history: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!history || history.length === 0) {
      const message = 'No locker assignment history data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportLockerAssignmentHistoryData(history, title)
    exportToExcel(exportData)
    return true
  } catch (error) {
    console.error('Error exporting locker assignment history to Excel:', error)
    const message = error instanceof Error ? error.message : 'Failed to export locker assignment history to Excel'
    if (onError) onError(message)
    return false
  }
}

// Parking Receipt PDF Generator - styled like a parking ticket
export interface ReceiptData {
  spotNumber: string
  spotLocation: string
  renterName: string
  renterEmail: string
  ownerName: string
  status: string
  dailyRate: number | string
  bookingDate: string
  paymentStatus: string
  bookingId?: string
}

export const generateParkingReceiptPDF = (receipt: ReceiptData, filename?: string) => {
  const doc = new jsPDF('portrait', 'mm', [100, 180]) // Smaller receipt-like size
  
  const pageWidth = doc.internal.pageSize.getWidth()
  const centerX = pageWidth / 2
  
  // Colors
  const darkGray = '#333333'
  const lightGray = '#888888'
  
  let y = 15
  
  // === HEADER: ParkShare Logo + Title ===
  // Draw dashed rectangle for logo
  doc.setDrawColor(darkGray)
  doc.setLineDashPattern([2, 2], 0)
  doc.setLineWidth(0.5)
  doc.rect(15, y, 30, 20)
  
  // Draw ParkShare logo (car with parking shelter/roof)
  doc.setFillColor(darkGray)
  doc.setLineDashPattern([], 0)
  
  // Shelter/roof structure (like a carport)
  doc.setLineWidth(1.5)
  doc.setDrawColor(darkGray)
  // Roof line
  doc.line(20, y + 5, 40, y + 5)
  // Support pillars
  doc.line(22, y + 5, 22, y + 8)
  doc.line(38, y + 5, 38, y + 8)
  
  // Car body (simplified sedan shape)
  doc.setFillColor(darkGray)
  // Main body
  doc.roundedRect(23, y + 11, 14, 6, 1, 1, 'F')
  // Cabin/roof
  doc.roundedRect(26, y + 8, 8, 4, 1, 1, 'F')
  // Wheels
  doc.circle(26, y + 17, 2, 'F')
  doc.circle(34, y + 17, 2, 'F')
  
  // Title
  doc.setLineDashPattern([], 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(darkGray)
  doc.text('Parking Receipt', 50, y + 12)
  
  y += 30
  
  // === MAIN CONTENT BOX ===
  // Draw dashed border around content
  doc.setDrawColor(lightGray)
  doc.setLineDashPattern([3, 3], 0)
  doc.setLineWidth(0.3)
  doc.rect(10, y, pageWidth - 20, 100)
  
  y += 10
  
  // Location/Address
  doc.setLineDashPattern([], 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(darkGray)
  doc.text('Address', centerX, y, { align: 'center' })
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(lightGray)
  // Split long location into multiple lines
  const locationLines = doc.splitTextToSize(receipt.spotLocation || 'N/A', pageWidth - 30)
  doc.text(locationLines, centerX, y, { align: 'center' })
  y += locationLines.length * 4 + 5
  
  // Ticket Number
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(darkGray)
  const ticketNum = receipt.bookingId ? receipt.bookingId.slice(0, 8).toUpperCase() : '000000'
  doc.text(`Ticket#: ${ticketNum}`, centerX, y, { align: 'center' })
  y += 10
  
  // Horizontal separator
  doc.setDrawColor(lightGray)
  doc.setLineDashPattern([2, 2], 0)
  doc.line(15, y, pageWidth - 15, y)
  y += 8
  
  // Date and Time row
  doc.setLineDashPattern([], 0)
  doc.setFontSize(9)
  const bookingDateStr = receipt.bookingDate || 'N/A'
  doc.text(`Date: ${bookingDateStr}`, 20, y)
  doc.setFont('helvetica', 'bold')
  doc.text('Time: Full Day', pageWidth - 20, y, { align: 'right' })
  y += 10
  
  // Duration
  doc.setFont('helvetica', 'normal')
  doc.text('Duration:', centerX - 10, y, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.text('1 Day', centerX - 5, y, { align: 'left' })
  y += 12
  
  // Horizontal separator
  doc.setDrawColor(lightGray)
  doc.setLineDashPattern([2, 2], 0)
  doc.line(15, y, pageWidth - 15, y)
  y += 10
  
  // PAID amount (large)
  doc.setLineDashPattern([], 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(darkGray)
  const amount = typeof receipt.dailyRate === 'number' ? receipt.dailyRate : parseFloat(receipt.dailyRate) || 0
  doc.text(`PAID: $${amount.toFixed(2)}`, centerX, y, { align: 'center' })
  y += 12
  
  // Payment status
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(lightGray)
  const paymentLabel = receipt.paymentStatus === 'received' ? 'Payment Confirmed' : 
                       receipt.paymentStatus === 'paid' ? 'Payment Sent' : 'Payment Pending'
  doc.text(`Status: ${paymentLabel}`, centerX, y, { align: 'center' })
  y += 12
  
  // Horizontal separator
  doc.setDrawColor(lightGray)
  doc.setLineDashPattern([2, 2], 0)
  doc.line(15, y, pageWidth - 15, y)
  y += 8
  
  // Thank you message
  doc.setLineDashPattern([], 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(darkGray)
  doc.text('THANK YOU', centerX, y, { align: 'center' })
  y += 5
  doc.text('AND DRIVE SAFELY', centerX, y, { align: 'center' })
  
  // Footer with spot info
  y += 15
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(lightGray)
  doc.text(`Spot: ${receipt.spotNumber || 'N/A'} | Renter: ${receipt.renterName || 'N/A'}`, centerX, y, { align: 'center' })
  y += 4
  doc.text('BCI ParkShare', centerX, y, { align: 'center' })
  
  // Save PDF
  const outputFilename = filename || `parking-receipt-${ticketNum}`
  doc.save(`${outputFilename}.pdf`)
  
  return true
}