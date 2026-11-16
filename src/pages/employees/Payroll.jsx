import { recordLabel } from '../../utils/recordReferences.js';
import { useState, useEffect } from "react";
import { Table } from '../../components/common/Table';
import { MobileCard } from '../../components/common/MobileCard';
import { Badge } from '../../components/common/Badge';
import { Loader } from '../../components/common/Loader';
import { getPayroll } from '../../services/payroll.service';

export const Payroll = () => {
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await getPayroll();
      setSlips(data);
      setLoading(false);
    };
    load();
  }, []);

  const columns = [
    { key: 'id', label: 'Slip #' },
    { key: 'employeeName', label: 'Employee' },
    { key: 'month', label: 'Period' },
    { key: 'basicSalary', label: 'Basic Salary' },
    { key: 'overtimePay', label: 'Overtime' },
    { key: 'netPay', label: 'Net Pay' },
    { key: 'status', label: 'Status' }
  ];

  if (loading) return <Loader />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc', margin: 0 }}>Payroll & Salary Disbursal</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>Review monthly staff salary slips, overtime bonuses, and deductions.</p>
      </div>

      <div className="desktop-table-view">
        <Table
          columns={columns}
          data={slips}
          renderRow={(item) => (
            <>
              <td style={{ padding: '12px 16px', fontWeight: '600', color: '#6366f1' }}>{recordLabel(item.id)}</td>
              <td style={{ padding: '12px 16px', color: '#f8fafc' }}>{item.employeeName}</td>
              <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{item.month}</td>
              <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>${item.basicSalary?.toFixed(2)}</td>
              <td style={{ padding: '12px 16px', color: '#34d399' }}>+${item.overtimePay?.toFixed(2)}</td>
              <td style={{ padding: '12px 16px', fontWeight: '700', color: '#f8fafc' }}>${item.netPay?.toFixed(2)}</td>
              <td style={{ padding: '12px 16px' }}>
                <Badge variant="success">PAID</Badge>
              </td>
            </>
          )}
        />
      </div>

      <div className="mobile-card-view">
        {slips.map((item) => (
          <MobileCard
            key={item.id}
            title={item.employeeName}
            subtitle={item.month}
            badge={<Badge variant="success">PAID</Badge>}
            fields={[
              { label: 'Basic Salary', value: `$${item.basicSalary?.toFixed(2)}` },
              { label: 'Net Disbursed', value: `$${item.netPay?.toFixed(2)}` }
            ]}
          />
        ))}
      </div>
    </div>
  );
};
