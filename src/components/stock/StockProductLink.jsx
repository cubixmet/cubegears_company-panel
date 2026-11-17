import { Link, useLocation } from 'react-router-dom';
import { stockProductRoute } from '../../utils/stockProductRoute';

export default function StockProductLink({ itemId, branchId, children }) {
  const { search } = useLocation();

  return (
    <Link className="cg-stock-product-link" to={stockProductRoute(itemId, branchId, search)}>
      {children}
    </Link>
  );
}
