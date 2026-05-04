function downloadReport(){
  const blob = new Blob(["C10 Report"], {type:"text/plain"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "report.txt";
  a.click();
}
