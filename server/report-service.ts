import * as sgMail from '@sendgrid/mail';
import ExcelJS from 'exceljs';
import type {
  ReportOverviewResponse,
  ReportUtilizationResponse,
  ReportRevenueResponse,
  ReportUserComplianceResponse,
  ReportWaitlistPerformanceResponse
} from '@shared/schema';

// Initialize SendGrid if API key is available
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_AVAILABLE = !!SENDGRID_API_KEY;

if (SENDGRID_AVAILABLE) {
  sgMail.setApiKey(SENDGRID_API_KEY!);
  console.log('✓ SendGrid initialized for report emails');
} else {
  console.warn('⚠️  SENDGRID_API_KEY not found - email reports will not be available');
}

// Check if SendGrid is available
export function isEmailServiceAvailable(): boolean {
  return SENDGRID_AVAILABLE;
}

// Generate Excel buffer for Overview Report
async function generateOverviewExcel(data: ReportOverviewResponse): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Overview Report');

  // Add title
  worksheet.mergeCells('A1:D1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'BCI ParkShare - Overview Report';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center' };

  // Add date range
  worksheet.mergeCells('A2:D2');
  const dateCell = worksheet.getCell('A2');
  dateCell.value = `Date Range: ${data.dateRange.from} to ${data.dateRange.to} | Scope: ${data.scope.toUpperCase()}`;
  dateCell.alignment = { horizontal: 'center' };

  worksheet.addRow([]);

  // Summary section
  worksheet.addRow(['SUMMARY METRICS']);
  worksheet.getCell('A4').font = { bold: true, size: 14 };
  
  worksheet.addRow(['Total Spots', data.summary.totalSpots]);
  worksheet.addRow(['Active Bookings', data.summary.activeBookings]);
  worksheet.addRow(['Total Revenue', `$${data.summary.totalRevenue.toFixed(2)}`]);
  worksheet.addRow(['Active Users', data.summary.activeUsers]);
  worksheet.addRow(['Waitlist Count', data.summary.waitlistCount]);
  worksheet.addRow(['Utilization Rate', `${data.summary.utilizationRate.toFixed(2)}%`]);

  worksheet.addRow([]);

  // Quick stats section
  worksheet.addRow(['QUICK STATS']);
  worksheet.getCell('A12').font = { bold: true, size: 14 };
  
  worksheet.addRow(['Today Bookings', data.quickStats.todayBookings]);
  worksheet.addRow(['This Week Revenue', `$${data.quickStats.thisWeekRevenue.toFixed(2)}`]);
  worksheet.addRow(['Pending Payments', data.quickStats.pendingPayments]);
  worksheet.addRow(['Active Disputes', data.quickStats.activeDisputes]);

  // Style columns
  worksheet.getColumn(1).width = 25;
  worksheet.getColumn(2).width = 20;

  return await workbook.xlsx.writeBuffer() as Buffer;
}

// Generate Excel buffer for Utilization Report
async function generateUtilizationExcel(data: ReportUtilizationResponse): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // Summary sheet
  const summarySheet = workbook.addWorksheet('Utilization Summary');
  summarySheet.mergeCells('A1:D1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'BCI ParkShare - Utilization Report';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center' };

  summarySheet.addRow([]);
  summarySheet.addRow(['SPOT USAGE']);
  summarySheet.addRow(['Total Spots', data.spotUsage.totalSpots]);
  summarySheet.addRow(['Allocated Spots', data.spotUsage.allocatedSpots]);
  summarySheet.addRow(['Unallocated Spots', data.spotUsage.unallocatedSpots]);
  summarySheet.addRow(['Bookable Spots', data.spotUsage.bookableSpots]);
  summarySheet.addRow(['Utilization Rate', `${data.spotUsage.utilizationRate.toFixed(2)}%`]);

  summarySheet.getColumn(1).width = 25;
  summarySheet.getColumn(2).width = 20;

  // Location breakdown sheet
  if (data.locationBreakdown.length > 0) {
    const locSheet = workbook.addWorksheet('Location Breakdown');
    locSheet.addRow(['Location', 'Total Spots', 'Occupied Spots', 'Occupancy Rate', 'Revenue']);
    const headerRow = locSheet.getRow(1);
    headerRow.font = { bold: true };
    
    data.locationBreakdown.forEach(loc => {
      locSheet.addRow([
        loc.location,
        loc.totalSpots,
        loc.occupiedSpots,
        `${loc.occupancyRate.toFixed(2)}%`,
        `$${loc.revenue.toFixed(2)}`
      ]);
    });
    
    locSheet.getColumn(1).width = 40;
    locSheet.getColumn(2).width = 15;
    locSheet.getColumn(3).width = 18;
    locSheet.getColumn(4).width = 18;
    locSheet.getColumn(5).width = 15;
  }

  // Spot type breakdown sheet
  if (data.spotTypeBreakdown.length > 0) {
    const typeSheet = workbook.addWorksheet('Spot Type Breakdown');
    typeSheet.addRow(['Type', 'Count', 'Booked Count', 'Utilization Rate']);
    const headerRow = typeSheet.getRow(1);
    headerRow.font = { bold: true };
    
    data.spotTypeBreakdown.forEach(type => {
      typeSheet.addRow([
        type.type,
        type.count,
        type.bookedCount,
        `${type.utilizationRate.toFixed(2)}%`
      ]);
    });
    
    typeSheet.getColumn(1).width = 25;
    typeSheet.getColumn(2).width = 15;
    typeSheet.getColumn(3).width = 18;
    typeSheet.getColumn(4).width = 20;
  }

  return await workbook.xlsx.writeBuffer() as Buffer;
}

// Generate Excel buffer for Revenue Report
async function generateRevenueExcel(data: ReportRevenueResponse): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // Summary sheet
  const summarySheet = workbook.addWorksheet('Revenue Summary');
  summarySheet.mergeCells('A1:D1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'BCI ParkShare - Revenue Report';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center' };

  summarySheet.addRow([]);
  summarySheet.addRow(['REVENUE SUMMARY']);
  summarySheet.addRow(['Total Revenue', `$${data.summary.totalRevenue.toFixed(2)}`]);
  summarySheet.addRow(['Owner Earnings', `$${data.summary.ownerEarnings.toFixed(2)}`]);
  summarySheet.addRow(['BCI Revenue', `$${data.summary.bciRevenue.toFixed(2)}`]);
  summarySheet.addRow(['Average Booking Value', `$${data.summary.averageBookingValue.toFixed(2)}`]);
  summarySheet.addRow(['Total Bookings', data.summary.totalBookings]);

  summarySheet.getColumn(1).width = 25;
  summarySheet.getColumn(2).width = 20;

  // Monthly trends sheet
  if (data.monthlyTrends.length > 0) {
    const trendsSheet = workbook.addWorksheet('Monthly Trends');
    trendsSheet.addRow(['Month', 'Revenue', 'Bookings', 'Average Value']);
    const headerRow = trendsSheet.getRow(1);
    headerRow.font = { bold: true };
    
    data.monthlyTrends.forEach(month => {
      trendsSheet.addRow([
        month.month,
        `$${month.revenue.toFixed(2)}`,
        month.bookings,
        `$${month.averageValue.toFixed(2)}`
      ]);
    });
    
    trendsSheet.getColumn(1).width = 15;
    trendsSheet.getColumn(2).width = 15;
    trendsSheet.getColumn(3).width = 15;
    trendsSheet.getColumn(4).width = 18;
  }

  // Top earners sheet
  if (data.topEarners.length > 0) {
    const earnersSheet = workbook.addWorksheet('Top Earners');
    earnersSheet.addRow(['Owner Name', 'Total Earnings', 'Bookings Count']);
    const headerRow = earnersSheet.getRow(1);
    headerRow.font = { bold: true };
    
    data.topEarners.forEach(earner => {
      earnersSheet.addRow([
        earner.ownerName,
        `$${earner.totalEarnings.toFixed(2)}`,
        earner.bookingsCount
      ]);
    });
    
    earnersSheet.getColumn(1).width = 30;
    earnersSheet.getColumn(2).width = 18;
    earnersSheet.getColumn(3).width = 18;
  }

  return await workbook.xlsx.writeBuffer() as Buffer;
}

// Generate Excel buffer for User Compliance Report
async function generateUserComplianceExcel(data: ReportUserComplianceResponse): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // Summary sheet
  const summarySheet = workbook.addWorksheet('User Activity Summary');
  summarySheet.mergeCells('A1:D1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'BCI ParkShare - User & Compliance Report';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center' };

  summarySheet.addRow([]);
  summarySheet.addRow(['USER ACTIVITY']);
  summarySheet.addRow(['Total Users', data.userActivity.totalUsers]);
  summarySheet.addRow(['Active Users', data.userActivity.activeUsers]);
  summarySheet.addRow(['New Registrations', data.userActivity.newRegistrations]);
  summarySheet.addRow(['Suspended Users', data.userActivity.suspendedUsers]);
  summarySheet.addRow(['Deleted Users', data.userActivity.deletedUsers]);

  summarySheet.addRow([]);
  summarySheet.addRow(['TERMS COMPLIANCE']);
  summarySheet.addRow(['Accepted Latest Terms', data.termsCompliance.acceptedLatestTerms]);
  summarySheet.addRow(['Pending Acceptance', data.termsCompliance.pendingAcceptance]);
  summarySheet.addRow(['Compliance Rate', `${data.termsCompliance.complianceRate.toFixed(2)}%`]);

  summarySheet.getColumn(1).width = 25;
  summarySheet.getColumn(2).width = 20;

  // Role distribution sheet
  if (data.roleDistribution.length > 0) {
    const rolesSheet = workbook.addWorksheet('Role Distribution');
    rolesSheet.addRow(['Role', 'Count', 'Percentage']);
    const headerRow = rolesSheet.getRow(1);
    headerRow.font = { bold: true };
    
    data.roleDistribution.forEach(role => {
      rolesSheet.addRow([
        role.role,
        role.count,
        `${role.percentage.toFixed(2)}%`
      ]);
    });
    
    rolesSheet.getColumn(1).width = 20;
    rolesSheet.getColumn(2).width = 15;
    rolesSheet.getColumn(3).width = 15;
  }

  return await workbook.xlsx.writeBuffer() as Buffer;
}

// Generate Excel buffer for Waitlist Performance Report
async function generateWaitlistPerformanceExcel(data: ReportWaitlistPerformanceResponse): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // Summary sheet
  const summarySheet = workbook.addWorksheet('Waitlist Summary');
  summarySheet.mergeCells('A1:D1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'BCI ParkShare - Waitlist Performance Report';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center' };

  summarySheet.addRow([]);
  summarySheet.addRow(['WAITLIST SUMMARY']);
  summarySheet.addRow(['Total Requests', data.summary.totalRequests]);
  summarySheet.addRow(['Active Requests', data.summary.activeRequests]);
  summarySheet.addRow(['Assigned Requests', data.summary.assignedRequests]);
  summarySheet.addRow(['Cancelled Requests', data.summary.cancelledRequests]);
  summarySheet.addRow(['Average Wait Time (days)', data.summary.averageWaitTime]);
  summarySheet.addRow(['Fulfillment Rate', `${data.summary.fulfillmentRate.toFixed(2)}%`]);

  summarySheet.getColumn(1).width = 30;
  summarySheet.getColumn(2).width = 20;

  // Priority breakdown sheet
  if (data.priorityBreakdown.length > 0) {
    const prioritySheet = workbook.addWorksheet('Priority Breakdown');
    prioritySheet.addRow(['Priority', 'Count', 'Avg Wait Days', 'Fulfillment Rate']);
    const headerRow = prioritySheet.getRow(1);
    headerRow.font = { bold: true };
    
    data.priorityBreakdown.forEach(priority => {
      prioritySheet.addRow([
        priority.priorityLabel,
        priority.count,
        priority.averageWaitDays,
        `${priority.fulfillmentRate.toFixed(2)}%`
      ]);
    });
    
    prioritySheet.getColumn(1).width = 15;
    prioritySheet.getColumn(2).width = 15;
    prioritySheet.getColumn(3).width = 18;
    prioritySheet.getColumn(4).width = 20;
  }

  return await workbook.xlsx.writeBuffer() as Buffer;
}

// Send report email
export async function sendReportEmail(
  reportType: 'overview' | 'utilization' | 'revenue' | 'user-compliance' | 'waitlist-performance',
  data: any,
  recipients: string[],
  dateRange: { from: string; to: string },
  scope: 'all' | 'bci'
): Promise<{ success: boolean; message: string }> {
  if (!SENDGRID_AVAILABLE) {
    return {
      success: false,
      message: 'Email service is not configured. Please contact your administrator to set up SENDGRID_API_KEY.'
    };
  }

  try {
    // Generate Excel attachment based on report type
    let attachment: Buffer;
    let reportTitle: string;
    let filename: string;

    switch (reportType) {
      case 'overview':
        attachment = await generateOverviewExcel(data);
        reportTitle = 'Overview Report';
        filename = 'overview-report.xlsx';
        break;
      case 'utilization':
        attachment = await generateUtilizationExcel(data);
        reportTitle = 'Utilization Report';
        filename = 'utilization-report.xlsx';
        break;
      case 'revenue':
        attachment = await generateRevenueExcel(data);
        reportTitle = 'Revenue Report';
        filename = 'revenue-report.xlsx';
        break;
      case 'user-compliance':
        attachment = await generateUserComplianceExcel(data);
        reportTitle = 'User & Compliance Report';
        filename = 'user-compliance-report.xlsx';
        break;
      case 'waitlist-performance':
        attachment = await generateWaitlistPerformanceExcel(data);
        reportTitle = 'Waitlist Performance Report';
        filename = 'waitlist-performance-report.xlsx';
        break;
      default:
        return {
          success: false,
          message: 'Invalid report type'
        };
    }

    // Prepare email content
    const scopeLabel = scope === 'bci' ? 'BCI-Managed' : 'All';
    const emailContent = {
      to: recipients,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@bciparkshare.com',
      subject: `BCI ParkShare - ${reportTitle} (${scopeLabel})`,
      text: `
Dear Admin,

Please find attached the ${reportTitle} for BCI ParkShare.

Report Details:
- Date Range: ${dateRange.from} to ${dateRange.to}
- Scope: ${scopeLabel}
- Generated: ${new Date().toLocaleString()}

This is an automated report from the BCI ParkShare system.

Best regards,
BCI ParkShare Admin System
      `,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
    <h1 style="margin: 0;">BCI ParkShare</h1>
    <p style="margin: 5px 0 0 0;">Admin Reports</p>
  </div>
  
  <div style="padding: 20px; background-color: #f8fafc;">
    <h2 style="color: #1e293b;">${reportTitle}</h2>
    
    <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <h3 style="color: #475569; margin-top: 0;">Report Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Date Range:</td>
          <td style="padding: 8px 0; font-weight: bold;">${dateRange.from} to ${dateRange.to}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Scope:</td>
          <td style="padding: 8px 0; font-weight: bold;">${scopeLabel}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Generated:</td>
          <td style="padding: 8px 0; font-weight: bold;">${new Date().toLocaleString()}</td>
        </tr>
      </table>
    </div>
    
    <p style="color: #475569;">
      The detailed report is attached as an Excel file. Please download and open it to view the complete data.
    </p>
    
    <div style="margin-top: 20px; padding: 15px; background-color: #dbeafe; border-left: 4px solid #2563eb; border-radius: 4px;">
      <p style="margin: 0; color: #1e40af;">
        <strong>Note:</strong> This is an automated report from the BCI ParkShare Admin System.
      </p>
    </div>
  </div>
  
  <div style="background-color: #1e293b; color: #94a3b8; padding: 15px; text-align: center; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} BCI ParkShare. All rights reserved.</p>
  </div>
</div>
      `,
      attachments: [
        {
          content: attachment.toString('base64'),
          filename,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          disposition: 'attachment'
        }
      ]
    };

    // Send email
    await sgMail.send(emailContent);

    return {
      success: true,
      message: `Report email sent successfully to ${recipients.join(', ')}`
    };
  } catch (error) {
    console.error('Error sending report email:', error);
    return {
      success: false,
      message: `Failed to send report email: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
