import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
// @ts-expect-error - file-saver types not compatible
import { saveAs } from 'file-saver'
import { PARKSHARE_LOGO_BASE64 } from './logo-constant'

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

const BCI_COLORS = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  secondary: '#64748b',
  accent: '#059669',
  text: '#1e293b',
  lightGray: '#f8fafc',
  mediumGray: '#e2e8f0',
  darkGray: '#475569'
}

export class PDFExporter {
  private doc: jsPDF

  constructor() {
    this.doc = new jsPDF('landscape', 'mm', 'a4')
  }

  private addBCIHeader(title: string, subtitle?: string) {
    const pageWidth = this.doc.internal.pageSize.getWidth()
    
    this.doc.setFillColor(BCI_COLORS.primary)
    this.doc.rect(20, 10, 60, 25, 'F')
    
    this.doc.setTextColor(255, 255, 255)
    this.doc.setFontSize(24)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('BCI', 50, 25, { align: 'center' })
    
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text('Parking Management', 50, 30, { align: 'center' })
    
    this.doc.setTextColor(BCI_COLORS.text)
    this.doc.setFontSize(20)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text(title, 90, 25)
    
    if (subtitle) {
      this.doc.setFontSize(12)
      this.doc.setFont('helvetica', 'normal')
      this.doc.setTextColor(BCI_COLORS.secondary)
      this.doc.text(subtitle, 90, 32)
    }
    
    const now = new Date()
    const dateStr = now.toLocaleDateString()
    const timeStr = now.toLocaleTimeString()
    
    this.doc.setFontSize(10)
    this.doc.setTextColor(BCI_COLORS.secondary)
    this.doc.text(`Generated: ${dateStr} at ${timeStr}`, pageWidth - 20, 20, { align: 'right' })
    
    this.doc.setDrawColor(BCI_COLORS.mediumGray)
    this.doc.setLineWidth(0.5)
    this.doc.line(20, 40, pageWidth - 20, 40)
  }

  private addBCIFooter() {
    const pageHeight = this.doc.internal.pageSize.getHeight()
    const pageWidth = this.doc.internal.pageSize.getWidth()
    const currentPage = this.doc.getCurrentPageInfo().pageNumber
    const pageCount = this.doc.getNumberOfPages()
    
    this.doc.setDrawColor(BCI_COLORS.mediumGray)
    this.doc.setLineWidth(0.5)
    this.doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20)
    
    this.doc.setFontSize(8)
    this.doc.setTextColor(BCI_COLORS.secondary)
    this.doc.text('BCI ParkShare - Confidential Report', 20, pageHeight - 15)
    
    this.doc.text(
      `Page ${currentPage} of ${pageCount}`,
      pageWidth - 20,
      pageHeight - 15,
      { align: 'right' }
    )
  }

  private addSummarySection(summary: ExportSummary) {
    const startY = 50
    
    this.doc.setFontSize(14)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setTextColor(BCI_COLORS.primary)
    this.doc.text('Report Summary', 20, startY)
    
    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    this.doc.setTextColor(BCI_COLORS.text)
    this.doc.text(`Total Records: ${summary.totalRecords}`, 20, startY + 8)
    
    let yOffset = startY + 16
    if (summary.additionalStats) {
      summary.additionalStats.forEach((stat) => {
        this.doc.text(`${stat.label}: ${stat.value}`, 20, yOffset)
        yOffset += 6
      })
    }
    
    return yOffset + 10
  }

  exportToPDF(exportData: ExportData): void {
    this.addBCIHeader(exportData.title, exportData.subtitle)
    
    let startY = 50
    
    if (exportData.summary) {
      startY = this.addSummarySection(exportData.summary)
    }
    
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
    
    this.doc.save(`${exportData.filename}.pdf`)
  }
}

export class ExcelExporter {
  async exportToExcel(exportData: ExportData): Promise<void> {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Report Data')
    
    worksheet.mergeCells('A1:D1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = 'BCI ParkShare'
    titleCell.font = { bold: true, size: 16 }
    
    worksheet.mergeCells('A2:D2')
    const reportTitleCell = worksheet.getCell('A2')
    reportTitleCell.value = exportData.title
    reportTitleCell.font = { bold: true, size: 14 }
    
    let currentRow = 3
    if (exportData.subtitle) {
      worksheet.mergeCells(`A${currentRow}:D${currentRow}`)
      worksheet.getCell(`A${currentRow}`).value = exportData.subtitle
      currentRow++
    }
    
    worksheet.getCell(`A${currentRow}`).value = `Generated: ${new Date().toLocaleString()}`
    currentRow += 2
    
    if (exportData.summary) {
      worksheet.getCell(`A${currentRow}`).value = 'REPORT SUMMARY'
      worksheet.getCell(`A${currentRow}`).font = { bold: true }
      currentRow++
      
      worksheet.getCell(`A${currentRow}`).value = `Total Records: ${exportData.summary.totalRecords}`
      currentRow++
      
      if (exportData.summary.additionalStats) {
        exportData.summary.additionalStats.forEach(stat => {
          worksheet.getCell(`A${currentRow}`).value = `${stat.label}: ${stat.value}`
          currentRow++
        })
      }
      currentRow++
    }
    
    const headerRow = worksheet.getRow(currentRow)
    exportData.columns.forEach((col, index) => {
      const cell = headerRow.getCell(index + 1)
      cell.value = col.header
      cell.font = { bold: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }
      }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    })
    currentRow++
    
    exportData.data.forEach(row => {
      const dataRow = worksheet.getRow(currentRow)
      exportData.columns.forEach((col, index) => {
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
        
        if (formattedValue === null || formattedValue === undefined) {
          dataRow.getCell(index + 1).value = '-'
        } else if (typeof formattedValue === 'object') {
          dataRow.getCell(index + 1).value = formattedValue instanceof Date 
            ? formattedValue.toLocaleDateString() 
            : JSON.stringify(formattedValue)
        } else {
          dataRow.getCell(index + 1).value = String(formattedValue)
        }
      })
      currentRow++
    })
    
    exportData.columns.forEach((col, index) => {
      worksheet.getColumn(index + 1).width = col.width || 15
    })
    
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `${exportData.filename}.xlsx`)
  }
}

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

export const exportToPDF = (exportData: ExportData) => {
  const pdfExporter = new PDFExporter()
  pdfExporter.exportToPDF(exportData)
}

export const exportToExcel = async (exportData: ExportData) => {
  const excelExporter = new ExcelExporter()
  await excelExporter.exportToExcel(exportData)
}

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

export const quickExportBookingsExcel = async (bookings: any[], title?: string, onError?: (message: string) => void, scope?: string) => {
  try {
    if (!bookings || bookings.length === 0) {
      const message = 'No booking data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportBookingsData(bookings, title, scope)
    await exportToExcel(exportData)
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

export const quickExportUsersExcel = async (users: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!users || users.length === 0) {
      const message = 'No user data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportUsersData(users, title)
    await exportToExcel(exportData)
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

export const quickExportParkingSpotsExcel = async (spots: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!spots || spots.length === 0) {
      const message = 'No parking spot data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportParkingSpotsData(spots, title)
    await exportToExcel(exportData)
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

export const quickExportWaitingListExcel = async (waitingList: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!waitingList || waitingList.length === 0) {
      const message = 'No waiting list data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportWaitingListData(waitingList, title)
    await exportToExcel(exportData)
    return true
  } catch (error) {
    console.error('Error exporting waiting list to Excel:', error)
    const message = error instanceof Error ? error.message : 'Failed to export waiting list to Excel'
    if (onError) onError(message)
    return false
  }
}

export const exportLocationsData = (locations: any[], title: string = 'Locations Report') => {
  const columns: ExportColumn[] = [
    { header: 'Location ID', dataKey: 'id', width: 15 },
    { header: 'Name', dataKey: 'name', width: 30 },
    { header: 'Address', dataKey: 'address', width: 40 },
    { header: 'Total Spots', dataKey: 'totalSpots', width: 12 },
    { header: 'Active', dataKey: 'isActive', width: 10, formatter: (active) => active ? 'Yes' : 'No' }
  ]

  const exportData: ExportData = {
    title,
    subtitle: 'Locations Management Report',
    data: locations,
    columns,
    filename: `locations-report-${new Date().toISOString().split('T')[0]}`,
    summary: {
      totalRecords: locations.length,
      additionalStats: [
        { label: 'Active Locations', value: locations.filter(l => l.isActive).length },
        { label: 'Total Spots', value: locations.reduce((sum, l) => sum + (l.totalSpots || 0), 0) }
      ]
    }
  }

  return exportData
}

export const quickExportLocationsPDF = (locations: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!locations || locations.length === 0) {
      const message = 'No location data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportLocationsData(locations, title)
    exportToPDF(exportData)
    return true
  } catch (error) {
    console.error('Error exporting locations to PDF:', error)
    const message = error instanceof Error ? error.message : 'Failed to export locations to PDF'
    if (onError) onError(message)
    return false
  }
}

export const quickExportLocationsExcel = async (locations: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!locations || locations.length === 0) {
      const message = 'No location data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportLocationsData(locations, title)
    await exportToExcel(exportData)
    return true
  } catch (error) {
    console.error('Error exporting locations to Excel:', error)
    const message = error instanceof Error ? error.message : 'Failed to export locations to Excel'
    if (onError) onError(message)
    return false
  }
}

export const exportLockersData = (lockers: any[], title: string = 'Locker Management Report') => {
  const columns: ExportColumn[] = [
    { header: 'Locker ID', dataKey: 'id', width: 15 },
    { header: 'Locker Number', dataKey: 'lockerNumber', width: 15 },
    { header: 'Location', dataKey: 'locationName', width: 25 },
    { header: 'Type', dataKey: 'lockerTypeName', width: 15 },
    { header: 'Status', dataKey: 'status', width: 12, formatter: (status) => status?.toUpperCase() || 'AVAILABLE' },
    { header: 'Assigned User', dataKey: 'assignedUserName', width: 20 },
    { header: 'User Email', dataKey: 'assignedUserEmail', width: 25 },
    { header: 'Department', dataKey: 'assignedUserDepartment', width: 20 },
    { header: 'BCI Managed', dataKey: 'isBciManaged', width: 12, formatter: (managed) => managed ? 'Yes' : 'No' },
    { header: 'Active', dataKey: 'isActive', width: 10, formatter: (active) => active ? 'Yes' : 'No' }
  ]

  const exportData: ExportData = {
    title,
    subtitle: 'Locker Inventory and Assignment Report',
    data: lockers,
    columns,
    filename: `lockers-report-${new Date().toISOString().split('T')[0]}`,
    summary: {
      totalRecords: lockers.length,
      additionalStats: [
        { label: 'Available', value: lockers.filter(l => !l.assignedUserId).length },
        { label: 'Assigned', value: lockers.filter(l => l.assignedUserId).length },
        { label: 'BCI Managed', value: lockers.filter(l => l.isBciManaged).length }
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

export const quickExportLockersExcel = async (lockers: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!lockers || lockers.length === 0) {
      const message = 'No locker data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportLockersData(lockers, title)
    await exportToExcel(exportData)
    return true
  } catch (error) {
    console.error('Error exporting lockers to Excel:', error)
    const message = error instanceof Error ? error.message : 'Failed to export lockers to Excel'
    if (onError) onError(message)
    return false
  }
}

export const exportLockerWaitlistData = (waitlist: any[], title: string = 'Locker Waitlist Report') => {
  const columns: ExportColumn[] = [
    { header: 'ID', dataKey: 'id', width: 15 },
    { header: 'User Name', dataKey: 'userName', width: 20 },
    { header: 'User Email', dataKey: 'userEmail', width: 25 },
    { header: 'Department', dataKey: 'userDepartment', width: 20 },
    { header: 'Location', dataKey: 'locationName', width: 20 },
    { header: 'Locker Type', dataKey: 'lockerTypeName', width: 15 },
    { header: 'Priority', dataKey: 'priority', width: 10 },
    { header: 'Status', dataKey: 'status', width: 12, formatter: (status) => status?.toUpperCase() || 'ACTIVE' },
    { header: 'Request Date', dataKey: 'requestDate', width: 15, formatter: (date) => date ? new Date(date).toLocaleDateString() : 'N/A' }
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
        { label: 'Pending', value: waitlist.filter(w => w.status === 'pending').length }
      ]
    }
  }

  return exportData
}

export const quickExportLockerWaitlistPDF = (waitlist: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!waitlist || waitlist.length === 0) {
      const message = 'No waitlist data available to export'
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

export const quickExportLockerWaitlistExcel = async (waitlist: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!waitlist || waitlist.length === 0) {
      const message = 'No waitlist data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportLockerWaitlistData(waitlist, title)
    await exportToExcel(exportData)
    return true
  } catch (error) {
    console.error('Error exporting locker waitlist to Excel:', error)
    const message = error instanceof Error ? error.message : 'Failed to export locker waitlist to Excel'
    if (onError) onError(message)
    return false
  }
}

export const exportLockerAssignmentHistoryData = (history: any[], title: string = 'Locker Assignment History') => {
  const columns: ExportColumn[] = [
    { header: 'ID', dataKey: 'id', width: 15 },
    { header: 'Locker Number', dataKey: 'lockerNumber', width: 15 },
    { header: 'Location', dataKey: 'locationName', width: 20 },
    { header: 'User Name', dataKey: 'userName', width: 20 },
    { header: 'User Email', dataKey: 'userEmail', width: 25 },
    { header: 'Action', dataKey: 'action', width: 12, formatter: (action) => action?.toUpperCase() || 'N/A' },
    { header: 'Actor', dataKey: 'actorName', width: 20 },
    { header: 'Date', dataKey: 'createdAt', width: 18, formatter: (date) => date ? new Date(date).toLocaleString() : 'N/A' },
    { header: 'Notes', dataKey: 'notes', width: 30 }
  ]

  const exportData: ExportData = {
    title,
    subtitle: 'Locker Assignment History Report',
    data: history,
    columns,
    filename: `locker-assignment-history-${new Date().toISOString().split('T')[0]}`,
    summary: {
      totalRecords: history.length,
      additionalStats: [
        { label: 'Assignments', value: history.filter(h => h.action === 'assigned').length },
        { label: 'Unassignments', value: history.filter(h => h.action === 'unassigned').length }
      ]
    }
  }

  return exportData
}

export const quickExportLockerAssignmentHistoryPDF = (history: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!history || history.length === 0) {
      const message = 'No history data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportLockerAssignmentHistoryData(history, title)
    exportToPDF(exportData)
    return true
  } catch (error) {
    console.error('Error exporting locker history to PDF:', error)
    const message = error instanceof Error ? error.message : 'Failed to export locker history to PDF'
    if (onError) onError(message)
    return false
  }
}

export const quickExportLockerAssignmentHistoryExcel = async (history: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!history || history.length === 0) {
      const message = 'No history data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportLockerAssignmentHistoryData(history, title)
    await exportToExcel(exportData)
    return true
  } catch (error) {
    console.error('Error exporting locker history to Excel:', error)
    const message = error instanceof Error ? error.message : 'Failed to export locker history to Excel'
    if (onError) onError(message)
    return false
  }
}

export interface ParkingReceiptData {
  spotNumber: string
  spotLocation: string
  renterName: string
  renterEmail: string
  ownerName: string
  status: string
  dailyRate: number
  bookingDate: string
  paymentStatus: string
  bookingId: string
}

export const generateParkingReceiptPDF = (receiptData: ParkingReceiptData, filename: string): void => {
  // Professional receipt dimensions
  const doc = new jsPDF('portrait', 'mm', [90, 155])
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const centerX = pageWidth / 2
  const margin = 8
  const innerMargin = margin + 4
  const contentWidth = pageWidth - (innerMargin * 2)
  
  // Dark professional colors
  const darkBlue = [30, 41, 59]    // Slate-800
  const mediumGray = [71, 85, 105] // Slate-500
  const lightGray = [241, 245, 249] // Slate-100
  const accentGreen = [16, 185, 129] // Emerald-500
  const white = [255, 255, 255]
  
  // Clean outer border
  doc.setDrawColor(darkBlue[0], darkBlue[1], darkBlue[2])
  doc.setLineWidth(0.8)
  doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2))
  
  let yPos = margin + 6
  
  // Header - White background with dark blue border
  doc.setFillColor(white[0], white[1], white[2])
  doc.setDrawColor(darkBlue[0], darkBlue[1], darkBlue[2])
  doc.setLineWidth(0.5)
  doc.rect(margin, margin, pageWidth - (margin * 2), 26, 'FD')
  
  // Add ParkShare logo
  try {
    doc.addImage(PARKSHARE_LOGO_BASE64, 'PNG', margin + 4, yPos + 2, 18, 18)
  } catch (e) {
    // Fallback: P icon with border
    doc.setDrawColor(darkBlue[0], darkBlue[1], darkBlue[2])
    doc.setLineWidth(0.5)
    doc.circle(margin + 13, yPos + 10, 8, 'S')
    doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2])
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('P', margin + 13, yPos + 13, { align: 'center' })
  }
  
  // Header text - dark blue on white
  doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2])
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('BCI ParkShare', margin + 26, yPos + 8)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Parking Receipt', margin + 26, yPos + 15)
  
  yPos = margin + 32
  
  // Divider line
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.2)
  doc.line(innerMargin, yPos, pageWidth - innerMargin, yPos)
  
  yPos += 6
  
  // Receipt Number
  doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2])
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Receipt #${receiptData.bookingId.slice(0, 8).toUpperCase()}`, centerX, yPos, { align: 'center' })
  
  yPos += 8
  
  // Location - wrapped text
  doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2])
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  const locationLines = doc.splitTextToSize(receiptData.spotLocation, contentWidth)
  locationLines.slice(0, 2).forEach((line: string, i: number) => {
    doc.text(line, centerX, yPos + (i * 5), { align: 'center' })
  })
  
  yPos += (Math.min(locationLines.length, 2) * 5) + 6
  
  // Spot Number - moderate size
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
  doc.rect(innerMargin, yPos, contentWidth, 14, 'F')
  
  doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2])
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text(`Spot ${receiptData.spotNumber}`, centerX, yPos + 10, { align: 'center' })
  
  yPos += 20
  
  // Date
  const bookingDate = new Date(receiptData.bookingDate)
  const dateStr = bookingDate.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })
  
  doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2])
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(dateStr, centerX, yPos, { align: 'center' })
  
  yPos += 5
  
  doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2])
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Duration: 1 Day', centerX, yPos, { align: 'center' })
  
  yPos += 10
  
  // Divider
  doc.setDrawColor(220, 220, 220)
  doc.line(innerMargin, yPos, pageWidth - innerMargin, yPos)
  
  yPos += 6
  
  // Renter row
  doc.setFontSize(9)
  doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2])
  doc.setFont('helvetica', 'normal')
  doc.text('Renter:', innerMargin, yPos)
  doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2])
  doc.setFont('helvetica', 'bold')
  doc.text(receiptData.renterName, pageWidth - innerMargin, yPos, { align: 'right' })
  
  yPos += 7
  
  // Owner row
  doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2])
  doc.setFont('helvetica', 'normal')
  doc.text('Owner:', innerMargin, yPos)
  doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2])
  doc.setFont('helvetica', 'bold')
  doc.text(receiptData.ownerName, pageWidth - innerMargin, yPos, { align: 'right' })
  
  yPos += 10
  
  // Divider
  doc.setDrawColor(220, 220, 220)
  doc.line(innerMargin, yPos, pageWidth - innerMargin, yPos)
  
  yPos += 8
  
  // Amount section - Dark blue background
  doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2])
  doc.rect(innerMargin, yPos, contentWidth, 18, 'F')
  
  // Green checkmark
  doc.setFillColor(accentGreen[0], accentGreen[1], accentGreen[2])
  doc.circle(innerMargin + 8, yPos + 9, 4, 'F')
  doc.setTextColor(white[0], white[1], white[2])
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('\u2713', innerMargin + 8, yPos + 11, { align: 'center' })
  
  // PAID amount in white
  doc.setTextColor(white[0], white[1], white[2])
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  const amount = typeof receiptData.dailyRate === 'number' ? receiptData.dailyRate : parseFloat(String(receiptData.dailyRate)) || 0
  doc.text(`PAID: $${amount.toFixed(2)}`, centerX + 4, yPos + 12, { align: 'center' })
  
  yPos += 24
  
  // Thank you message
  doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2])
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Thank you for using ParkShare!', centerX, yPos, { align: 'center' })
  
  yPos += 5
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Drive safely', centerX, yPos, { align: 'center' })
  
  doc.save(`${filename}.pdf`)
}

export const exportBookingActivityData = (activities: any[], title: string = 'Booking Activity Report') => {
  const columns: ExportColumn[] = [
    { header: 'Activity ID', dataKey: 'id', width: 15 },
    { header: 'Booking ID', dataKey: 'bookingId', width: 15 },
    { header: 'Action', dataKey: 'action', width: 15 },
    { header: 'User Name', dataKey: 'userName', width: 20 },
    { header: 'User Email', dataKey: 'userEmail', width: 25 },
    { header: 'Details', dataKey: 'details', width: 40 },
    { header: 'Timestamp', dataKey: 'timestamp', width: 18, formatter: (date) => date ? new Date(date).toLocaleString() : 'N/A' }
  ]

  const exportData: ExportData = {
    title,
    subtitle: 'Booking Activity Log Report',
    data: activities,
    columns,
    filename: `booking-activity-report-${new Date().toISOString().split('T')[0]}`,
    summary: {
      totalRecords: activities.length
    }
  }

  return exportData
}

export const quickExportBookingActivityPDF = (activities: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!activities || activities.length === 0) {
      const message = 'No booking activity data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportBookingActivityData(activities, title)
    exportToPDF(exportData)
    return true
  } catch (error) {
    console.error('Error exporting booking activity to PDF:', error)
    const message = error instanceof Error ? error.message : 'Failed to export booking activity to PDF'
    if (onError) onError(message)
    return false
  }
}

export const quickExportBookingActivityExcel = async (activities: any[], title?: string, onError?: (message: string) => void) => {
  try {
    if (!activities || activities.length === 0) {
      const message = 'No booking activity data available to export'
      if (onError) onError(message)
      return false
    }
    const exportData = exportBookingActivityData(activities, title)
    await exportToExcel(exportData)
    return true
  } catch (error) {
    console.error('Error exporting booking activity to Excel:', error)
    const message = error instanceof Error ? error.message : 'Failed to export booking activity to Excel'
    if (onError) onError(message)
    return false
  }
}
