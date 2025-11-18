import React from "react";
import { ListGroup } from 'react-bootstrap';

type DataFieldItem = [React.ReactNode, React.ReactNode];

const DataField: React.FC<{
  data: DataFieldItem[]
}> = ({ data }) => (
  <ListGroup variant="flush">
    {data.map(([label, value], index) => (
      <ListGroup.Item key={index} className="py-2 px-0">
        <div className="mb-1 small text-muted">{label}</div>
        <div>{value}</div>
      </ListGroup.Item>
    ))}
  </ListGroup>
);


export default DataField; 