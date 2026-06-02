@Library('devops-lib') _

pipeline {
    agent any

    stages {

        stage('Detect Language') {
            steps {
                script {
                    detectLanguage()
                }
            }
        }

        stage('Build') {
            steps {
                script {
                    buildProject()
                }
            }
        }

        stage('Test') {
            steps {
                script {
                    testProject()
                }
            }
        }
    }
}
