{
  "nodes": [
    { "id": "battery", "type": "source" },
    { "id": "ecm", "type": "control", "load": 5 },
    { "id": "fuel_pump", "type": "motor", "load": 15 }
  ],
  "edges": [
    {
      "from": "battery",
      "to": "ecm",
      "type": "POWER",
      "zone": "B",
      "resistance": 0.02
    },
    {
      "from": "ecm",
      "to": "fuel_pump",
      "type": "POWER",
      "zone": "E",
      "resistance": 0.04
    }
  ]
}
