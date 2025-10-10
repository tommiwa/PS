import * as XLSX from 'xlsx';
// @ts-ignore
import { saveAs } from 'file-saver';
import type {
  ReportOverviewResponse,
  ReportUtilizationResponse,
  ReportRevenueResponse,
  ReportUserComplianceResponse,
  ReportWaitlistPerformanceResponse,
  ReportDateRange
} from '@shared/schema';

// Helper function to create styled worksheet header
function createReportHeader(ws: XLSX.WorkSheet, title: string, dateRange: ReportDateRange, scope: string) {
  // Title row
  XLSX.utils.sheet_add_aoa(ws, [[title]], { origin: 'A1' });
  
  // Date range row
  const scopeLabel = scope === 'bci' ? 'BCI-Managed' : 'All';
  XLSX.utils.sheet_add_aoa(ws, [[`Date Range: ${dateRange.from} to ${dateRange.to} | Scope: ${scopeLabel}`]], { origin: 'A2' });
  
  // Generated timestamp
  XLSX.utils.sheet_add_aoa(ws, [[`Generated: ${new Date().toLocaleString()}`]], { origin: 'A3' });
  
  // Empty row for spacing
  XLSX.utils.sheet_add_aoa(ws, [['']], { origin: 'A4' });
}

// Export Overview Report
export function exportOverviewReport(data: ReportOverviewResponse, dateRange?: ReportDateRange) {
  const wb = XLSX.utils.book_new();
  const wsData: any[][] = [];
  
  const range = dateRange || data.dateRange;
  
  // Title and metadata
  wsData.push(['BCI ParkShare - Overview Report']);
  wsData.push([`Date Range: ${range.from} to ${range.to} | Scope: ${data.scope.toUpperCase()}`]);
  wsData.push([`Generated: ${new Date().toLocaleString()}`]);
  wsData.push(['']); // Empty row
  
  // Summary Metrics
  wsData.push(['SUMMARY METRICS']);
  wsData.push(['Metric', 'Value']);
  wsData.push(['Total Spots', data.summary.totalSpots]);
  wsData.push(['Active Bookings', data.summary.activeBookings]);
  wsData.push(['Total Revenue', `$${data.summary.totalRevenue.toFixed(2)}`]);
  wsData.push(['Active Users', data.summary.activeUsers]);
  wsData.push(['Waitlist Count', data.summary.waitlistCount]);
  wsData.push(['Utilization Rate', `${data.summary.utilizationRate.toFixed(2)}%`]);
  wsData.push(['']); // Empty row
  
  // Quick Stats
  wsData.push(['QUICK STATS']);
  wsData.push(['Metric', 'Value']);
  wsData.push(['Today Bookings', data.quickStats.todayBookings]);
  wsData.push(['This Week Revenue', `$${data.quickStats.thisWeekRevenue.toFixed(2)}`]);
  wsData.push(['Pending Payments', data.quickStats.pendingPayments]);
  wsData.push(['Active Disputes', data.quickStats.activeDisputes]);
  
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  ws['!cols'] = [{ wch: 25 }, { wch: 20 }];
  
  XLSX.utils.book_append_sheet(wb, ws, 'Overview');
  
  // Save file
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const scopeSuffix = data.scope === 'bci' ? '-bci' : '';
  saveAs(new Blob([wbout]), `overview-report${scopeSuffix}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Export Utilization Report
export function exportUtilizationReport(data: ReportUtilizationResponse, dateRange?: ReportDateRange) {
  const wb = XLSX.utils.book_new();
  const range = dateRange || data.dateRange;
  
  // Summary sheet
  const summaryData: any[][] = [];
  summaryData.push(['BCI ParkShare - Utilization Report']);
  summaryData.push([`Date Range: ${range.from} to ${range.to} | Scope: ${data.scope.toUpperCase()}`]);
  summaryData.push([`Generated: ${new Date().toLocaleString()}`]);
  summaryData.push(['']);
  
  summaryData.push(['SPOT USAGE']);
  summaryData.push(['Metric', 'Value']);
  summaryData.push(['Total Spots', data.spotUsage.totalSpots]);
  summaryData.push(['Allocated Spots', data.spotUsage.allocatedSpots]);
  summaryData.push(['Unallocated Spots', data.spotUsage.unallocatedSpots]);
  summaryData.push(['Bookable Spots', data.spotUsage.bookableSpots]);
  summaryData.push(['Utilization Rate', `${data.spotUsage.utilizationRate.toFixed(2)}%`]);
  
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  
  // Location breakdown sheet
  if (data.locationBreakdown.length > 0) {
    const locData: any[][] = [];
    locData.push(['Location', 'Total Spots', 'Occupied Spots', 'Occupancy Rate', 'Revenue']);
    
    data.locationBreakdown.forEach(loc => {
      locData.push([
        loc.location,
        loc.totalSpots,
        loc.occupiedSpots,
        `${loc.occupancyRate.toFixed(2)}%`,
        `$${loc.revenue.toFixed(2)}`
      ]);
    });
    
    const wsLoc = XLSX.utils.aoa_to_sheet(locData);
    wsLoc['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsLoc, 'Locations');
  }
  
  // Spot type breakdown sheet
  if (data.spotTypeBreakdown.length > 0) {
    const typeData: any[][] = [];
    typeData.push(['Type', 'Count', 'Booked Count', 'Utilization Rate']);
    
    data.spotTypeBreakdown.forEach(type => {
      typeData.push([
        type.type,
        type.count,
        type.bookedCount,
        `${type.utilizationRate.toFixed(2)}%`
      ]);
    });
    
    const wsType = XLSX.utils.aoa_to_sheet(typeData);
    wsType['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsType, 'Spot Types');
  }
  
  // Daily occupancy sheet
  if (data.dailyOccupancy.length > 0) {
    const dailyData: any[][] = [];
    dailyData.push(['Date', 'Occupied Spots', 'Total Spots', 'Occupancy Rate']);
    
    data.dailyOccupancy.forEach(day => {
      dailyData.push([
        day.date,
        day.occupiedSpots,
        day.totalSpots,
        `${day.occupancyRate.toFixed(2)}%`
      ]);
    });
    
    const wsDaily = XLSX.utils.aoa_to_sheet(dailyData);
    wsDaily['!cols'] = [{ wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Occupancy');
  }
  
  // Save file
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const scopeSuffix = data.scope === 'bci' ? '-bci' : '';
  saveAs(new Blob([wbout]), `utilization-report${scopeSuffix}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Export Revenue Report
export function exportRevenueReport(data: ReportRevenueResponse, dateRange?: ReportDateRange) {
  const wb = XLSX.utils.book_new();
  const range = dateRange || data.dateRange;
  
  // Summary sheet
  const summaryData: any[][] = [];
  summaryData.push(['BCI ParkShare - Revenue Report']);
  summaryData.push([`Date Range: ${range.from} to ${range.to} | Scope: ${data.scope.toUpperCase()}`]);
  summaryData.push([`Generated: ${new Date().toLocaleString()}`]);
  summaryData.push(['']);
  
  summaryData.push(['REVENUE SUMMARY']);
  summaryData.push(['Metric', 'Value']);
  summaryData.push(['Total Revenue', `$${data.summary.totalRevenue.toFixed(2)}`]);
  summaryData.push(['Owner Earnings (85%)', `$${data.summary.ownerEarnings.toFixed(2)}`]);
  summaryData.push(['BCI Revenue (15%)', `$${data.summary.bciRevenue.toFixed(2)}`]);
  summaryData.push(['Average Booking Value', `$${data.summary.averageBookingValue.toFixed(2)}`]);
  summaryData.push(['Total Bookings', data.summary.totalBookings]);
  
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  
  // Monthly trends sheet
  if (data.monthlyTrends.length > 0) {
    const trendsData: any[][] = [];
    trendsData.push(['Month', 'Revenue', 'Bookings', 'Average Value']);
    
    data.monthlyTrends.forEach(month => {
      trendsData.push([
        month.month,
        `$${month.revenue.toFixed(2)}`,
        month.bookings,
        `$${month.averageValue.toFixed(2)}`
      ]);
    });
    
    const wsTrends = XLSX.utils.aoa_to_sheet(trendsData);
    wsTrends['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsTrends, 'Monthly Trends');
  }
  
  // Revenue by location sheet
  if (data.revenueByLocation.length > 0) {
    const locData: any[][] = [];
    locData.push(['Location', 'Revenue', 'Bookings', 'Average Rate']);
    
    data.revenueByLocation.forEach(loc => {
      locData.push([
        loc.location,
        `$${loc.revenue.toFixed(2)}`,
        loc.bookings,
        `$${loc.averageRate.toFixed(2)}`
      ]);
    });
    
    const wsLoc = XLSX.utils.aoa_to_sheet(locData);
    wsLoc['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsLoc, 'Revenue by Location');
  }
  
  // Revenue by spot type sheet
  if (data.revenueBySpotType.length > 0) {
    const typeData: any[][] = [];
    typeData.push(['Spot Type', 'Revenue', 'Bookings']);
    
    data.revenueBySpotType.forEach(type => {
      typeData.push([
        type.type,
        `$${type.revenue.toFixed(2)}`,
        type.bookings
      ]);
    });
    
    const wsType = XLSX.utils.aoa_to_sheet(typeData);
    wsType['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsType, 'Revenue by Type');
  }
  
  // Top earners sheet
  if (data.topEarners.length > 0) {
    const earnersData: any[][] = [];
    earnersData.push(['Owner Name', 'Total Earnings', 'Bookings Count']);
    
    data.topEarners.forEach(earner => {
      earnersData.push([
        earner.ownerName,
        `$${earner.totalEarnings.toFixed(2)}`,
        earner.bookingsCount
      ]);
    });
    
    const wsEarners = XLSX.utils.aoa_to_sheet(earnersData);
    wsEarners['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsEarners, 'Top Earners');
  }
  
  // Save file
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const scopeSuffix = data.scope === 'bci' ? '-bci' : '';
  saveAs(new Blob([wbout]), `revenue-report${scopeSuffix}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Export User Compliance Report
export function exportUserComplianceReport(data: ReportUserComplianceResponse, dateRange?: ReportDateRange) {
  const wb = XLSX.utils.book_new();
  const range = dateRange || data.dateRange;
  
  // Summary sheet
  const summaryData: any[][] = [];
  summaryData.push(['BCI ParkShare - User & Compliance Report']);
  summaryData.push([`Date Range: ${range.from} to ${range.to} | Scope: ${data.scope.toUpperCase()}`]);
  summaryData.push([`Generated: ${new Date().toLocaleString()}`]);
  summaryData.push(['']);
  
  summaryData.push(['USER ACTIVITY']);
  summaryData.push(['Metric', 'Value']);
  summaryData.push(['Total Users', data.userActivity.totalUsers]);
  summaryData.push(['Active Users', data.userActivity.activeUsers]);
  summaryData.push(['New Registrations', data.userActivity.newRegistrations]);
  summaryData.push(['Suspended Users', data.userActivity.suspendedUsers]);
  summaryData.push(['Deleted Users', data.userActivity.deletedUsers]);
  summaryData.push(['']);
  
  summaryData.push(['TERMS COMPLIANCE']);
  summaryData.push(['Metric', 'Value']);
  summaryData.push(['Accepted Latest Terms', data.termsCompliance.acceptedLatestTerms]);
  summaryData.push(['Pending Acceptance', data.termsCompliance.pendingAcceptance]);
  summaryData.push(['Compliance Rate', `${data.termsCompliance.complianceRate.toFixed(2)}%`]);
  
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  
  // Role distribution sheet
  if (data.roleDistribution.length > 0) {
    const roleData: any[][] = [];
    roleData.push(['Role', 'Count', 'Percentage']);
    
    data.roleDistribution.forEach(role => {
      roleData.push([
        role.role,
        role.count,
        `${role.percentage.toFixed(2)}%`
      ]);
    });
    
    const wsRole = XLSX.utils.aoa_to_sheet(roleData);
    wsRole['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsRole, 'Role Distribution');
  }
  
  // Department breakdown sheet
  if (data.departmentBreakdown.length > 0) {
    const deptData: any[][] = [];
    deptData.push(['Department', 'User Count', 'Active Users', 'Spots Owned', 'Bookings Made']);
    
    data.departmentBreakdown.forEach(dept => {
      deptData.push([
        dept.department,
        dept.userCount,
        dept.activeUsers,
        dept.spotsOwned,
        dept.bookingsMade
      ]);
    });
    
    const wsDept = XLSX.utils.aoa_to_sheet(deptData);
    wsDept['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsDept, 'Departments');
  }
  
  // Save file
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const scopeSuffix = data.scope === 'bci' ? '-bci' : '';
  saveAs(new Blob([wbout]), `user-compliance-report${scopeSuffix}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Export Waitlist Performance Report
export function exportWaitlistPerformanceReport(data: ReportWaitlistPerformanceResponse, dateRange?: ReportDateRange) {
  const wb = XLSX.utils.book_new();
  const range = dateRange || data.dateRange;
  
  // Summary sheet
  const summaryData: any[][] = [];
  summaryData.push(['BCI ParkShare - Waitlist Performance Report']);
  summaryData.push([`Date Range: ${range.from} to ${range.to} | Scope: ${data.scope.toUpperCase()}`]);
  summaryData.push([`Generated: ${new Date().toLocaleString()}`]);
  summaryData.push(['']);
  
  summaryData.push(['WAITLIST SUMMARY']);
  summaryData.push(['Metric', 'Value']);
  summaryData.push(['Total Requests', data.summary.totalRequests]);
  summaryData.push(['Active Requests', data.summary.activeRequests]);
  summaryData.push(['Assigned Requests', data.summary.assignedRequests]);
  summaryData.push(['Cancelled Requests', data.summary.cancelledRequests]);
  summaryData.push(['Average Wait Time (days)', data.summary.averageWaitTime]);
  summaryData.push(['Fulfillment Rate', `${data.summary.fulfillmentRate.toFixed(2)}%`]);
  
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  
  // Priority breakdown sheet
  if (data.priorityBreakdown.length > 0) {
    const priorityData: any[][] = [];
    priorityData.push(['Priority', 'Count', 'Avg Wait Days', 'Fulfillment Rate']);
    
    data.priorityBreakdown.forEach(priority => {
      priorityData.push([
        priority.priorityLabel,
        priority.count,
        priority.averageWaitDays,
        `${priority.fulfillmentRate.toFixed(2)}%`
      ]);
    });
    
    const wsPriority = XLSX.utils.aoa_to_sheet(priorityData);
    wsPriority['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsPriority, 'Priority Breakdown');
  }
  
  // Spot type preferences sheet
  if (data.spotTypePreferences.length > 0) {
    const typeData: any[][] = [];
    typeData.push(['Spot Type', 'Request Count', 'Fulfilled Count', 'Fulfillment Rate']);
    
    data.spotTypePreferences.forEach(type => {
      typeData.push([
        type.spotType,
        type.requestCount,
        type.fulfilledCount,
        `${type.fulfillmentRate.toFixed(2)}%`
      ]);
    });
    
    const wsType = XLSX.utils.aoa_to_sheet(typeData);
    wsType['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsType, 'Spot Preferences');
  }
  
  // Department requests sheet
  if (data.departmentRequests.length > 0) {
    const deptData: any[][] = [];
    deptData.push(['Department', 'Active Requests', 'Assigned Requests', 'Avg Wait Days']);
    
    data.departmentRequests.forEach(dept => {
      deptData.push([
        dept.department,
        dept.activeRequests,
        dept.assignedRequests,
        dept.averageWaitDays
      ]);
    });
    
    const wsDept = XLSX.utils.aoa_to_sheet(deptData);
    wsDept['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 20 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsDept, 'Department Requests');
  }
  
  // Save file
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const scopeSuffix = data.scope === 'bci' ? '-bci' : '';
  saveAs(new Blob([wbout]), `waitlist-performance-report${scopeSuffix}-${new Date().toISOString().split('T')[0]}.xlsx`);
}
