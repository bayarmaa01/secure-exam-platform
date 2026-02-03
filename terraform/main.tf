provider "aws" {
  region = "ap-east-1"
}

resource "aws_instance" "exam_server" {
  ami           = "ami-0f5ee92e2d63afc18"
  instance_type = "t2.micro"
  tags = {
    Name = "exam-k8s-node"
  }
}
